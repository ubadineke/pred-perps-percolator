//! Read-only diagnostic: simulates a Moxie hard-flat against an existing fixture,
//! both alone and preceded by full-observation cranks in the same transaction.
//! Nothing is submitted.
use anyhow::{bail, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use solana_client::{rpc_client::RpcClient, rpc_config::RpcSimulateTransactionConfig};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    hash::hash,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Signer},
    transaction::Transaction,
};
use std::{env, time::Duration};

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 8 && args.len() != 9 {
        bail!("usage: probe_hard_flat <rpc-url> <percolator-program> <oracle-program> <market> <trader-portfolio> <lp-portfolio> <payer-keypair> [--catch-up]");
    }
    let client = RpcClient::new_with_timeout_and_commitment(
        args[1].clone(),
        Duration::from_secs(60),
        CommitmentConfig::confirmed(),
    );
    let program_id: Pubkey = args[2].parse()?;
    let oracle_program_id: Pubkey = args[3].parse()?;
    let market: Pubkey = args[4].parse()?;
    let trader_portfolio: Pubkey = args[5].parse()?;
    let lp_portfolio: Pubkey = args[6].parse()?;
    let payer = read_keypair_file(&args[7]).map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let (oracle_config, _) =
        Pubkey::find_program_address(&[b"config", market.as_ref()], &oracle_program_id);
    let record_for = |external_id: &str| {
        Pubkey::find_program_address(
            &[b"imported", oracle_config.as_ref(), hash(external_id.as_bytes()).as_ref()],
            &oracle_program_id,
        )
        .0
    };
    // PROBE_ASSETS=1 limits observations to single-asset fixtures (default: both lifecycle events).
    let all_events = [(1u16, record_for("jup-sol-250-friday")), (2u16, record_for("jup-fed-cut-next-meeting"))];
    let wanted: Vec<u16> = env::var("PROBE_ASSETS")
        .ok()
        .map(|v| v.split(',').filter_map(|x| x.trim().parse().ok()).collect())
        .unwrap_or_else(|| vec![1, 2]);
    let events: Vec<(u16, Pubkey)> = all_events.into_iter().filter(|(i, _)| wanted.contains(i)).collect();

    let portfolio_owner = |address: &Pubkey| -> Result<Pubkey> {
        let data = client.get_account_data(address)?;
        Ok(Pubkey::new_from_array(state::read_portfolio_owner_preflight(&data)?.1))
    };
    let crank = |owner: Pubkey, portfolio: Pubkey| Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(owner, false),
            AccountMeta::new(market, false),
            AccountMeta::new(portfolio, false),
        ],
        data: PercolatorInstruction::PermissionlessCrank {
            now_slot: 0,
            observations: events
                .iter()
                .map(|(asset_index, _)| percolator_prog::ix::CrankObservationHint {
                    asset_index: *asset_index,
                    oracle_accounts: 0,
                })
                .collect(),
        }
        .encode(),
    };
    let snapshot = |address: &Pubkey| -> Result<(u64, u64)> {
        let data = client.get_account_data(address)?;
        Ok((state::read_portfolio_id(&data)?, state::read_portfolio_position_epoch(&data)?))
    };
    let (trader_id, trader_epoch) = snapshot(&trader_portfolio)?;
    let (lp_id, lp_epoch) = snapshot(&lp_portfolio)?;
    let hard_flat = |record: Pubkey| {
        let mut data = vec![7u8];
        for value in [trader_id, trader_epoch, lp_id, lp_epoch] {
            data.extend_from_slice(&value.to_le_bytes());
        }
        data.extend_from_slice(&1_000_000u128.to_le_bytes());
        Instruction {
            program_id: oracle_program_id,
            accounts: vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(oracle_config, false),
                AccountMeta::new(record, false),
                AccountMeta::new(market, false),
                AccountMeta::new(trader_portfolio, false),
                AccountMeta::new(lp_portfolio, false),
                AccountMeta::new_readonly(program_id, false),
            ],
            data,
        }
    };
    let trader_owner = portfolio_owner(&trader_portfolio)?;
    let lp_owner = portfolio_owner(&lp_portfolio)?;
    let budget = [
        ComputeBudgetInstruction::request_heap_frame(128 * 1024),
        ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
    ];
    let simulate = |label: &str, instructions: Vec<Instruction>| -> Result<()> {
        let mut all = budget.to_vec();
        all.extend(instructions);
        let tx = Transaction::new_signed_with_payer(
            &all,
            Some(&payer.pubkey()),
            &[&payer],
            client.get_latest_blockhash()?,
        );
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
        for line in result.logs.unwrap_or_default() {
            if line.contains("moxie_hard_flat") || line.contains("failed") || line.contains("Program log") {
                println!("   {line}");
            }
        }
        Ok(())
    };

    // Optional: submit permissionless catch-up cranks (the harness's own pre-hard-flat
    // loop) until both event assets are within one accrual segment of the clock.
    if args.get(8).map(String::as_str) == Some("--catch-up") {
        for round in 0..64 {
            let (_, group) = state::read_market(&client.get_account_data(&market)?)?;
            let now_slot = client.get_slot()?;
            let lag = events
                .iter()
                .map(|(i, _)| now_slot.saturating_sub(group.assets[*i as usize].slot_last))
                .max()
                .unwrap_or(0);
            let mut certs_current = true;
            for address in [trader_portfolio, lp_portfolio] {
                let p = state::read_portfolio(&client.get_account_data(&address)?)?;
                let cert = p.health_cert.try_to_runtime().map_err(|e| anyhow::anyhow!("{e:?}"))?;
                certs_current &= cert.valid
                    && cert.cert_funding_epoch == group.funding_epoch
                    && cert.cert_oracle_epoch == group.oracle_epoch
                    && cert.cert_risk_epoch == group.risk_epoch
                    && cert.cert_asset_set_epoch == group.asset_set_epoch
                    && p.stale_state == 0
                    && p.b_stale_state == 0;
            }
            println!(
                "round {round}: now={now_slot} current_slot={} asset_slot_last={:?}",
                group.current_slot,
                events.iter().map(|(i, _)| group.assets[*i as usize].slot_last).collect::<Vec<_>>()
            );
            if certs_current {
                println!("certificates current after {round} rounds (lag={lag})");
                break;
            }
            let mut all = budget.to_vec();
            all.extend([crank(trader_owner, trader_portfolio), crank(lp_owner, lp_portfolio)]);
            let tx = Transaction::new_signed_with_payer(
                &all,
                Some(&payer.pubkey()),
                &[&payer],
                client.get_latest_blockhash()?,
            );
            client
                .send_and_confirm_transaction(&tx)
                .map_err(|e| anyhow::anyhow!("catch-up crank: {e:?}"))?;
        }
    }

    let (_, group) = state::read_market(&client.get_account_data(&market)?)?;
    println!(
        "config max_abs_funding_e9_per_slot={} min_funding_lifetime_slots={} max_accrual_dt_slots={} max_price_move_bps_per_slot={} liquidation_fee_bps={} h_max={} max_bankrupt_close_lifetime_slots={}",
        group.config.max_abs_funding_e9_per_slot,
        group.config.min_funding_lifetime_slots,
        group.config.max_accrual_dt_slots,
        group.config.max_price_move_bps_per_slot,
        group.config.liquidation_fee_bps,
        group.config.h_max,
        group.config.max_bankrupt_close_lifetime_slots
    );
    let now_slot = client.get_slot()?;
    println!(
        "market mode={:?} current_slot={} now_slot={} epochs(funding={} oracle={} risk={} asset_set={})",
        group.mode, group.current_slot, now_slot, group.funding_epoch, group.oracle_epoch,
        group.risk_epoch, group.asset_set_epoch
    );
    for &(asset_index, _) in &events {
        let asset = &group.assets[asset_index as usize];
        println!(
            "asset {asset_index}: lifecycle={:?} slot_last={} lag={}",
            asset.lifecycle,
            asset.slot_last,
            now_slot.saturating_sub(asset.slot_last)
        );
    }
    for &(asset_index, _) in &events {
        let profile = state::read_asset_oracle_profile(&client.get_account_data(&market)?, asset_index as usize)?;
        println!(
            "profile {asset_index}: absolute_funding={} funding_mark={} pending={}@{} mark_ewma={}@{}",
            profile._padding0[0], profile.funding_mark_e6, profile.funding_mark_pending_e6,
            profile.funding_mark_pending_slot, profile.mark_ewma_e6, profile.mark_ewma_last_slot
        );
    }
    for (label, address) in [("trader", trader_portfolio), ("lp", lp_portfolio)] {
        let p = state::read_portfolio(&client.get_account_data(&address)?)?;
        let cert = p.health_cert.try_to_runtime().map_err(|e| anyhow::anyhow!("{e:?}"))?;
        println!(
            "{label}: stale={} b_stale={} cert_valid={} cert_epochs(funding={} oracle={} risk={} asset_set={}) bitmap_match={}",
            p.stale_state, p.b_stale_state, cert.valid, cert.cert_funding_epoch, cert.cert_oracle_epoch,
            cert.cert_risk_epoch, cert.cert_asset_set_epoch,
            cert.active_bitmap_at_cert == p.active_bitmap.map(|w| w.get())
        );
    }

    let event_a = events[0].1;
    simulate("hard-flat A alone", vec![hard_flat(event_a)])?;
    simulate(
        "cranks (trader, lp) + hard-flat A in one tx",
        vec![crank(trader_owner, trader_portfolio), crank(lp_owner, lp_portfolio), hard_flat(event_a)],
    )?;
    simulate(
        "cranks only",
        vec![crank(trader_owner, trader_portfolio), crank(lp_owner, lp_portfolio)],
    )?;
    Ok(())
}
