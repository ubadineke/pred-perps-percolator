use anyhow::{bail, Result};
use percolator_prog::state;
use serde::Serialize;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{commitment_config::CommitmentConfig, pubkey::Pubkey};
use std::{env, time::Duration};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarketInspection {
    market: String,
    configured_assets: usize,
    next_market_id: u64,
    mode: String,
    threshold_stress_active: bool,
    bankruptcy_lock_active: bool,
    loss_stale_active: bool,
    stale_certificate_count: u64,
    backing_stale_account_count: u64,
    negative_pnl_account_count: u64,
    materialized_portfolio_count: u64,
    risk_epoch: u64,
    oracle_epoch: u64,
    funding_epoch: u64,
    slot_last: u64,
    current_slot: u64,
    initial_margin_bps: u64,
    maintenance_margin_bps: u64,
    max_price_move_bps_per_slot: u64,
    max_accrual_dt_slots: u64,
    asset_prices: Vec<AssetPriceInspection>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AssetPriceInspection {
    asset_index: usize,
    market_id: u64,
    lifecycle: String,
    mode_long: String,
    mode_short: String,
    stored_position_count_long: u64,
    stored_position_count_short: u64,
    raw_target_e6: u64,
    effective_e6: u64,
    slot_last: u64,
    open_interest_long_q: u128,
    open_interest_short_q: u128,
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        bail!("usage: inspect_market <rpc-url> <market-account>")
    }
    let client = RpcClient::new_with_timeout_and_commitment(
        args[1].clone(),
        Duration::from_secs(60),
        CommitmentConfig::confirmed(),
    );
    let market: Pubkey = args[2].parse()?;
    let (_, group) = state::read_market(&client.get_account(&market)?.data)?;
    let asset_prices = group
        .assets
        .iter()
        .enumerate()
        .map(|(asset_index, asset)| AssetPriceInspection {
            asset_index,
            market_id: asset.market_id,
            lifecycle: format!("{:?}", asset.lifecycle),
            mode_long: format!("{:?}", asset.mode_long),
            mode_short: format!("{:?}", asset.mode_short),
            stored_position_count_long: asset.stored_pos_count_long,
            stored_position_count_short: asset.stored_pos_count_short,
            raw_target_e6: asset.raw_oracle_target_price,
            effective_e6: asset.effective_price,
            slot_last: asset.slot_last,
            open_interest_long_q: asset.oi_eff_long_q,
            open_interest_short_q: asset.oi_eff_short_q,
        })
        .collect();
    let output = MarketInspection {
        market: market.to_string(),
        configured_assets: group.assets.len(),
        next_market_id: group.next_market_id,
        mode: format!("{:?}", group.mode),
        threshold_stress_active: group.threshold_stress_active,
        bankruptcy_lock_active: group.bankruptcy_hlock_active,
        loss_stale_active: group.loss_stale_active,
        stale_certificate_count: group.stale_certificate_count,
        backing_stale_account_count: group.b_stale_account_count,
        negative_pnl_account_count: group.negative_pnl_account_count,
        materialized_portfolio_count: group.materialized_portfolio_count,
        risk_epoch: group.risk_epoch,
        oracle_epoch: group.oracle_epoch,
        funding_epoch: group.funding_epoch,
        slot_last: group.slot_last,
        current_slot: group.current_slot,
        initial_margin_bps: group.config.initial_margin_bps,
        maintenance_margin_bps: group.config.maintenance_margin_bps,
        max_price_move_bps_per_slot: group.config.max_price_move_bps_per_slot,
        max_accrual_dt_slots: group.config.max_accrual_dt_slots,
        asset_prices,
    };
    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}
