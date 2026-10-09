//! Minimal devnet keeper: keeps every listed event asset accrued to the live
//! slot so risk-increasing trades are not rejected as loss-stale.
//!
//! The web terminal submits bare TradeCpi transactions. Once an asset carries
//! open interest, Percolator rejects risk-increasing trades while the asset's
//! accrual trails the market clock, and each crank advances an asset by at most
//! one bounded step. This loop performs that catch-up continuously.
use anyhow::{bail, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Signer},
    transaction::Transaction,
};
use std::{env, thread, time::Duration};

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 7 {
        bail!("usage: keeper_loop <rpc-url> <percolator-program> <market> <crank-portfolio> <asset-indexes e.g. 1,2> <payer-keypair>");
    }
    let client = RpcClient::new_with_timeout_and_commitment(
        args[1].clone(),
        Duration::from_secs(60),
        CommitmentConfig::confirmed(),
    );
    let program: Pubkey = args[2].parse()?;
    let market: Pubkey = args[3].parse()?;
    let crank_portfolio: Pubkey = args[4].parse()?;
    let assets: Vec<u16> = args[5]
        .split(',')
        .map(|value| value.trim().parse())
        .collect::<Result<_, _>>()?;
    let payer = read_keypair_file(&args[6]).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let portfolio_owner = Pubkey::new_from_array(
        state::read_portfolio_owner_preflight(&client.get_account_data(&crank_portfolio)?)?.1,
    );
    let crank = || Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new_readonly(portfolio_owner, false),
            AccountMeta::new(market, false),
            AccountMeta::new(crank_portfolio, false),
        ],
        data: PercolatorInstruction::PermissionlessCrank {
            now_slot: 0,
            observations: assets
                .iter()
                .map(|asset_index| percolator_prog::ix::CrankObservationHint {
                    asset_index: *asset_index,
                    oracle_accounts: 0,
                })
                .collect(),
        }
        .encode(),
    };
    println!("keeper: market={market} assets={assets:?} crank_portfolio={crank_portfolio}");
    // Accrual per crank varies (a flat-price segment advances up to
    // `max_accrual_dt_slots`; an exposed asset's bounded path can advance far
    // less), so learn it from observed progress instead of assuming the cap.
    let mut advance_per_crank: u64 = 16;
    let mut previous: Option<(u64, usize)> = None;
    loop {
        let mut tick = || -> Result<()> {
            let (_, group) = state::read_market(&client.get_account_data(&market)?)?;
            let now = client.get_slot()?;
            let slowest = assets
                .iter()
                .map(|asset_index| group.assets[*asset_index as usize].slot_last)
                .min()
                .unwrap_or(now);
            if let Some((last_slowest, last_count)) = previous.take() {
                if slowest > last_slowest && last_count > 0 {
                    advance_per_crank = ((slowest - last_slowest) / last_count as u64).max(1);
                }
            }
            let lag = now.saturating_sub(slowest);
            let clock_ahead = assets
                .iter()
                .any(|asset_index| group.assets[*asset_index as usize].slot_last < group.current_slot);
            if lag <= 8 && !clock_ahead {
                return Ok(());
            }
            // Leave ~one crank of headroom so the batch never reaches the live slot
            // early (a trailing no-op crank would revert the whole batch).
            let count = usize::try_from((lag / advance_per_crank).saturating_sub(1).clamp(1, 8))?;
            let mut instructions = vec![
                ComputeBudgetInstruction::request_heap_frame(128 * 1024),
                ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            ];
            instructions.extend((0..count).map(|_| crank()));
            let tx = Transaction::new_signed_with_payer(
                &instructions,
                Some(&payer.pubkey()),
                &[&payer],
                client.get_latest_blockhash()?,
            );
            match client.send_and_confirm_transaction(&tx) {
                Ok(signature) => {
                    previous = Some((slowest, count));
                    println!(
                        "keeper: lag={lag} cranks={count} advance/crank={advance_per_crank} sig={}",
                        &signature.to_string()[..12]
                    );
                }
                // A crank with nothing left to do reverts the batch; shrink next time.
                Err(error) if format!("{error:?}").contains("Custom(22)") => {
                    advance_per_crank = advance_per_crank.saturating_mul(2);
                }
                Err(error) => eprintln!("keeper: crank failed (lag={lag}): {error:?}"),
            }
            Ok(())
        };
        if let Err(error) = tick() {
            eprintln!("keeper: tick error: {error:#}");
        }
        thread::sleep(Duration::from_secs(2));
    }
}
