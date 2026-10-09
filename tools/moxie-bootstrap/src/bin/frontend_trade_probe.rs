//! Read-only diagnostic: simulates the web terminal's bare TradeCpi (no leading
//! crank) against a live market, then the same trade behind one crank, and
//! prints the market's accrual lag. Nothing is submitted.
use anyhow::{bail, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use solana_client::{rpc_client::RpcClient, rpc_config::RpcSimulateTransactionConfig};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Signer},
    transaction::Transaction,
};
use std::{env, time::Duration};

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 13 {
        bail!("usage: frontend_trade_probe <rpc-url> <percolator> <matcher> <market> <trader-portfolio> <lp-portfolio> <matcher-context> <matcher-delegate> <trader-keypair> <asset-index> <market-id> <size-q>");
    }
    let client = RpcClient::new_with_timeout_and_commitment(
        args[1].clone(),
        Duration::from_secs(60),
        CommitmentConfig::confirmed(),
    );
    let percolator: Pubkey = args[2].parse()?;
    let matcher: Pubkey = args[3].parse()?;
    let market: Pubkey = args[4].parse()?;
    let trader_portfolio: Pubkey = args[5].parse()?;
    let lp: Pubkey = args[6].parse()?;
    let matcher_context: Pubkey = args[7].parse()?;
    let matcher_delegate: Pubkey = args[8].parse()?;
    // Argument 9 may be a keypair file, or just a wallet address (simulation only, unsigned).
    let trader_keypair = read_keypair_file(&args[9]).ok();
    let trader_pubkey: Pubkey = match &trader_keypair {
        Some(k) => k.pubkey(),
        None => args[9].parse()?,
    };
    let asset_index: u16 = args[10].parse()?;
    let market_id: u64 = args[11].parse()?;
    let size_q: i128 = args[12].parse()?;

    let ids = |address: &Pubkey| -> Result<(u64, u64, u64)> {
        let data = client.get_account_data(address)?;
        Ok((
            state::read_portfolio_id(&data)?,
            state::read_portfolio_position_epoch(&data)?,
            state::read_portfolio_matcher_sequence(&data)?,
        ))
    };
    let (trader_id, trader_epoch, _) = ids(&trader_portfolio)?;
    let (lp_id, lp_epoch, lp_sequence) = ids(&lp)?;
    let (_, group) = state::read_market(&client.get_account_data(&market)?)?;
    let asset = &group.assets[asset_index as usize];
    let now = client.get_slot()?;
    println!(
        "market current_slot={} asset slot_last={} chain_slot={} lag={} max_accrual_dt={} oi_long={} oi_short={}",
        group.current_slot,
        asset.slot_last,
        now,
        now.saturating_sub(asset.slot_last),
        group.config.max_accrual_dt_slots,
        asset.oi_eff_long_q,
        asset.oi_eff_short_q
    );

    let trade = Instruction {
        program_id: percolator,
        accounts: vec![
            AccountMeta::new_readonly(trader_pubkey, true),
            AccountMeta::new(market, false),
            AccountMeta::new(trader_portfolio, false),
            AccountMeta::new(lp, false),
            AccountMeta::new_readonly(matcher, false),
            AccountMeta::new(matcher_context, false),
            AccountMeta::new_readonly(matcher_delegate, false),
        ],
        data: PercolatorInstruction::TradeCpi {
            account_a_portfolio_id: trader_id,
            account_a_position_epoch: trader_epoch,
            account_b_portfolio_id: lp_id,
            account_b_position_epoch: lp_epoch,
            account_b_matcher_sequence: lp_sequence,
            asset_index,
            market_id,
            size_q,
            fee_bps: 30,
            limit_price: if size_q > 0 { 999_999 } else { 1 },
            backing_fee_cap_bps: 0,
        }
        .encode(),
    };
    // PROBE_PAD=N appends N zero bytes to the TradeCpi data (mirrors a fixed-size TS buffer).
    let mut trade = trade;
    if let Some(pad) = env::var("PROBE_PAD").ok().and_then(|v| v.parse::<usize>().ok()) {
        trade.data.extend(std::iter::repeat(0u8).take(pad));
    }
    let crank = Instruction {
        program_id: percolator,
        accounts: vec![
            AccountMeta::new_readonly(trader_pubkey, false),
            AccountMeta::new(market, false),
            AccountMeta::new(trader_portfolio, false),
        ],
        data: PercolatorInstruction::PermissionlessCrank {
            now_slot: 0,
            observations: vec![percolator_prog::ix::CrankObservationHint {
                asset_index,
                oracle_accounts: 0,
            }],
        }
        .encode(),
    };
    let budget = vec![
        ComputeBudgetInstruction::request_heap_frame(128 * 1024),
        ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
    ];
    for (label, tail) in [
        ("bare TradeCpi (web terminal)", vec![trade.clone()]),
        ("crank + TradeCpi", vec![crank, trade]),
    ] {
        let mut instructions = budget.clone();
        instructions.extend(tail);
        let tx = match &trader_keypair {
            Some(k) => Transaction::new_signed_with_payer(
                &instructions,
                Some(&trader_pubkey),
                &[k],
                client.get_latest_blockhash()?,
            ),
            None => Transaction::new_unsigned(solana_sdk::message::Message::new(
                &instructions,
                Some(&trader_pubkey),
            )),
        };
        let result = client
            .simulate_transaction_with_config(
                &tx,
                RpcSimulateTransactionConfig {
                    sig_verify: false,
                    replace_recent_blockhash: true,
                    commitment: Some(CommitmentConfig::confirmed()),
                    ..Default::default()
                },
            )?
            .value;
        println!("== {label}: err={:?} units={:?}", result.err, result.units_consumed);
        // PROBE_SEND=1 submits the bare variant for real when it simulates cleanly.
        if env::var("PROBE_SEND").as_deref() == Ok("1") && trader_keypair.is_some() && label.starts_with("bare") && result.err.is_none() {
            let signature = client
                .send_and_confirm_transaction(&tx)
                .map_err(|e| anyhow::anyhow!("{e:?}"))?;
            println!("   sent {signature}");
            return Ok(());
        }
        for line in result.logs.unwrap_or_default() {
            if true {
                println!("   {line}");
            }
        }
    }
    Ok(())
}
