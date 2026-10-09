use anyhow::{bail, Context, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{read_keypair_file, Keypair, Signature, Signer},
    system_instruction, system_program,
    transaction::Transaction,
};
use spl_associated_token_account::{
    get_associated_token_address_with_program_id, instruction::create_associated_token_account,
};
use std::{env, fs};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    portfolio: Portfolio,
    price: Price,
    risk: Risk,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Portfolio {
    max_assets: u16,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Price {
    initial_e6: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Risk {
    maintenance_margin_bps: u64,
    initial_margin_bps: u64,
    max_trading_fee_bps: u64,
    trade_fee_base_bps: u64,
    liquidation_fee_bps: u64,
    liquidation_fee_cap_atoms: u128,
    min_liquidation_fee_atoms: u128,
    max_price_move_bps_per_slot: u64,
    max_accrual_dt_slots: Option<u64>,
    max_abs_funding_e9_per_slot: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Receipt {
    cluster: &'static str,
    market_account: String,
    oracle_config: String,
    usdc_mint: String,
    vault_authority: String,
    collateral_vault: String,
    max_assets: u16,
    initialization_signature: String,
    oracle_signature: String,
}

fn send(
    client: &RpcClient,
    payer: &Keypair,
    ixs: &[Instruction],
    extra: &[&Keypair],
) -> Result<Signature> {
    let mut signers = vec![payer];
    signers.extend_from_slice(extra);
    let tx = Transaction::new_signed_with_payer(
        ixs,
        Some(&payer.pubkey()),
        &signers,
        client.get_latest_blockhash()?,
    );
    client
        .send_and_confirm_transaction(&tx)
        .map_err(|e| anyhow::anyhow!("{e:?}"))
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 7 {
        bail!("usage: init_market_group <rpc-url> <percolator-program> <oracle-program> <payer-keypair> <config> <receipt-output>");
    }
    let client = RpcClient::new_with_commitment(args[1].clone(), CommitmentConfig::confirmed());
    let percolator: Pubkey = args[2].parse()?;
    let oracle: Pubkey = args[3].parse()?;
    let payer = read_keypair_file(&args[4]).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let cfg: Config = serde_json::from_slice(&fs::read(&args[5])?)?;

    let mint = Keypair::new();
    let mint_rent = client.get_minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN)?;
    send(
        &client,
        &payer,
        &[
            system_instruction::create_account(
                &payer.pubkey(),
                &mint.pubkey(),
                mint_rent,
                spl_token::state::Mint::LEN as u64,
                &spl_token::id(),
            ),
            spl_token::instruction::initialize_mint2(
                &spl_token::id(),
                &mint.pubkey(),
                &payer.pubkey(),
                None,
                6,
            )?,
        ],
        &[&mint],
    )
    .context("create devnet USDC mint")?;

    let market = Keypair::new();
    let market_len = state::market_account_len_for_capacity(cfg.portfolio.max_assets as usize)?;
    let max_accrual_dt_slots = cfg.risk.max_accrual_dt_slots.unwrap_or(100);
    let init = PercolatorInstruction::InitMarket {
        // Active legs a portfolio may hold (shared margin across events). InitMarket
        // always starts with one configured market slot; imported events are appended
        // later through UpdateAssetLifecycle into the reserved `maxAssets` capacity.
        max_portfolio_assets: cfg.portfolio.max_assets,
        h_min: 0,
        h_max: 10,
        initial_price: cfg.price.initial_e6,
        min_nonzero_mm_req: cfg.risk.min_liquidation_fee_atoms.saturating_add(2),
        min_nonzero_im_req: cfg.risk.min_liquidation_fee_atoms.saturating_add(3),
        maintenance_margin_bps: cfg.risk.maintenance_margin_bps,
        initial_margin_bps: cfg.risk.initial_margin_bps,
        max_trading_fee_bps: cfg.risk.max_trading_fee_bps,
        trade_fee_base_bps: cfg.risk.trade_fee_base_bps,
        liquidation_fee_bps: cfg.risk.liquidation_fee_bps,
        liquidation_fee_cap: cfg.risk.liquidation_fee_cap_atoms,
        min_liquidation_abs: cfg.risk.min_liquidation_fee_atoms,
        max_price_move_bps_per_slot: cfg.risk.max_price_move_bps_per_slot / 100,
        max_accrual_dt_slots,
        max_abs_funding_e9_per_slot: cfg.risk.max_abs_funding_e9_per_slot,
        min_funding_lifetime_slots: max_accrual_dt_slots.max(100),
        max_account_b_settlement_chunks: 1,
        max_bankrupt_close_chunks: 1,
        max_bankrupt_close_lifetime_slots: 100,
        public_b_chunk_atoms: 10_000_000_000_000_000,
        maintenance_fee_per_slot: 0,
    };
    let initialization_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            system_instruction::create_account(
                &payer.pubkey(),
                &market.pubkey(),
                client.get_minimum_balance_for_rent_exemption(market_len)?,
                market_len as u64,
                &percolator,
            ),
            Instruction {
                program_id: percolator,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(market.pubkey(), false),
                    AccountMeta::new_readonly(mint.pubkey(), false),
                ],
                data: init.encode(),
            },
        ],
        &[&market],
    )
    .context("initialize clean Percolator market group")?;

    let (vault_authority, _) =
        Pubkey::find_program_address(&[b"vault", market.pubkey().as_ref()], &percolator);
    let vault = get_associated_token_address_with_program_id(
        &vault_authority,
        &mint.pubkey(),
        &spl_token::id(),
    );
    send(
        &client,
        &payer,
        &[create_associated_token_account(
            &payer.pubkey(),
            &vault_authority,
            &mint.pubkey(),
            &spl_token::id(),
        )],
        &[],
    )?;

    let (oracle_config, _) =
        Pubkey::find_program_address(&[b"config", market.pubkey().as_ref()], &oracle);
    let mut data = vec![0u8];
    data.extend_from_slice(payer.pubkey().as_ref());
    data.extend_from_slice(&30u64.to_le_bytes());
    data.extend_from_slice(&1_000u64.to_le_bytes());
    data.extend_from_slice(&2_500u32.to_le_bytes());
    data.extend_from_slice(&2_000u32.to_le_bytes());
    data.extend_from_slice(&20_000u64.to_le_bytes());
    data.extend_from_slice(&15_000u64.to_le_bytes());
    data.extend_from_slice(&100_000u64.to_le_bytes());
    data.extend_from_slice(&10u32.to_le_bytes());
    data.extend_from_slice(&[0u8; 4]);
    data.extend_from_slice(&50_000u64.to_le_bytes());
    data.extend_from_slice(&5_000u64.to_le_bytes());
    data.extend_from_slice(&150_000u64.to_le_bytes());
    data.extend_from_slice(&500u64.to_le_bytes());
    let oracle_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id: oracle,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new(oracle_config, false),
                    AccountMeta::new_readonly(percolator, false),
                    AccountMeta::new(market.pubkey(), false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
                data,
            },
        ],
        &[],
    )
    .context("initialize Moxie oracle policy")?;

    let receipt = Receipt {
        cluster: "devnet",
        market_account: market.pubkey().to_string(),
        oracle_config: oracle_config.to_string(),
        usdc_mint: mint.pubkey().to_string(),
        vault_authority: vault_authority.to_string(),
        collateral_vault: vault.to_string(),
        max_assets: cfg.portfolio.max_assets,
        initialization_signature: initialization_signature.to_string(),
        oracle_signature: oracle_signature.to_string(),
    };
    fs::write(
        &args[6],
        format!("{}\n", serde_json::to_string_pretty(&receipt)?),
    )?;
    println!("initialized clean group {}", receipt.market_account);
    Ok(())
}
