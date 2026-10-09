use anyhow::{bail, Context, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use serde::Serialize;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Keypair, Signature, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::{
    get_associated_token_address_with_program_id, instruction::create_associated_token_account,
};
use std::{env, fs};

const DEFAULT_LP_DEPOSIT_E6: u64 = 1_000_000_000; // 1,000 devnet USDC
const DEFAULT_MAX_FILL_Q: u128 = 10_000_000; // 10 contracts per fill
const DEFAULT_MAX_INVENTORY_Q: u128 = 100_000_000; // 100 contracts net

/// Optional sizing overrides: MOXIE_LP_DEPOSIT_E6, MOXIE_MATCHER_MAX_FILL_Q,
/// MOXIE_MATCHER_MAX_INVENTORY_Q (contracts are 1_000_000 q each).
fn env_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
const MATCHER_CONTEXT_LEN: usize = 320;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Receipt {
    cluster: &'static str,
    owner: String,
    market_account: String,
    lp_portfolio: String,
    matcher_context: String,
    matcher_delegate: String,
    collateral_mint: String,
    collateral_deposited_e6: u64,
    matcher_expiry_slot: u64,
    portfolio_signature: String,
    deposit_signature: String,
    matcher_signature: String,
    binding_signature: String,
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
        .map_err(|error| anyhow::anyhow!("{error:?}"))
}

fn matcher_init_data(expiry_slot: u64, close_time: i64) -> Vec<u8> {
    let restricted_at = close_time.saturating_sub(30 * 60);
    let reduce_only_at = close_time.saturating_sub(10 * 60);
    let hard_flat_at = close_time.saturating_sub(60);
    let mut data = vec![6u8];
    for value in [3_000u32, 100_000, 10_000, 80_000, 1_000, 2_000, 0, 1_000] {
        data.extend_from_slice(&value.to_le_bytes());
    }
    data.extend_from_slice(&expiry_slot.to_le_bytes());
    data.extend_from_slice(&1_000_000_000u128.to_le_bytes());
    data.extend_from_slice(&env_or("MOXIE_MATCHER_MAX_FILL_Q", DEFAULT_MAX_FILL_Q).to_le_bytes());
    data.extend_from_slice(&env_or("MOXIE_MATCHER_MAX_INVENTORY_Q", DEFAULT_MAX_INVENTORY_Q).to_le_bytes());
    data.extend_from_slice(&1_000u32.to_le_bytes());
    data.extend_from_slice(&restricted_at.to_le_bytes());
    data.extend_from_slice(&reduce_only_at.to_le_bytes());
    data.extend_from_slice(&hard_flat_at.to_le_bytes());
    data.extend_from_slice(&5_000u32.to_le_bytes());
    data.extend_from_slice(&7_500u32.to_le_bytes());
    data
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 10 {
        bail!("usage: seed_liquidity <rpc-url> <percolator-program> <matcher-program> <market-account> <collateral-mint> <collateral-vault> <payer-keypair> <close-time-seconds> <receipt-output>");
    }
    let client = RpcClient::new_with_commitment(args[1].clone(), CommitmentConfig::confirmed());
    let percolator: Pubkey = args[2].parse()?;
    let matcher: Pubkey = args[3].parse()?;
    let market: Pubkey = args[4].parse()?;
    let mint: Pubkey = args[5].parse()?;
    let vault: Pubkey = args[6].parse()?;
    let payer = read_keypair_file(&args[7]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let close_time: i64 = args[8].parse()?;
    let now = client.get_block_time(client.get_slot()?)?;
    if close_time <= now + 15 * 60 {
        bail!("refusing to seed a matcher less than 15 minutes before market close");
    }

    let market_data = client.get_account(&market)?.data;
    let (_, group) = state::read_market(&market_data)?;
    let portfolio_len = state::portfolio_account_len_for_market_slots(group.assets.len())?;
    let portfolio = Keypair::new();
    let portfolio_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            system_instruction::create_account(
                &payer.pubkey(),
                &portfolio.pubkey(),
                client.get_minimum_balance_for_rent_exemption(portfolio_len)?,
                portfolio_len as u64,
                &percolator,
            ),
            Instruction {
                program_id: percolator,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(market, false),
                    AccountMeta::new(portfolio.pubkey(), false),
                ],
                data: PercolatorInstruction::InitPortfolio.encode(),
            },
        ],
        &[&portfolio],
    )
    .context("create the operator-owned LP portfolio")?;

    let source =
        get_associated_token_address_with_program_id(&payer.pubkey(), &mint, &spl_token::id());
    let mut fund = Vec::new();
    if client.get_account(&source).is_err() {
        fund.push(create_associated_token_account(
            &payer.pubkey(),
            &payer.pubkey(),
            &mint,
            &spl_token::id(),
        ));
    }
    fund.push(spl_token::instruction::mint_to(
        &spl_token::id(),
        &mint,
        &source,
        &payer.pubkey(),
        &[],
        env_or("MOXIE_LP_DEPOSIT_E6", DEFAULT_LP_DEPOSIT_E6),
    )?);
    send(&client, &payer, &fund, &[]).context("mint devnet collateral for the Moxie LP")?;

    let portfolio_account = client.get_account(&portfolio.pubkey())?;
    let portfolio_id = state::read_portfolio_id(&portfolio_account.data)?;
    let sequence = state::read_portfolio_matcher_sequence(&portfolio_account.data)?;
    let deposit_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id: percolator,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(market, false),
                    AccountMeta::new(portfolio.pubkey(), false),
                    AccountMeta::new(source, false),
                    AccountMeta::new(vault, false),
                    AccountMeta::new_readonly(spl_token::id(), false),
                ],
                data: PercolatorInstruction::Deposit {
                    portfolio_id,
                    expected_sequence: sequence,
                    amount: u128::from(env_or("MOXIE_LP_DEPOSIT_E6", DEFAULT_LP_DEPOSIT_E6)),
                }
                .encode(),
            },
        ],
        &[],
    )
    .context("deposit Moxie-owned collateral into the LP portfolio")?;

    let context = Keypair::new();
    let (delegate, _) = Pubkey::find_program_address(
        &[
            b"matcher",
            market.as_ref(),
            portfolio.pubkey().as_ref(),
            payer.pubkey().as_ref(),
            matcher.as_ref(),
            context.pubkey().as_ref(),
        ],
        &percolator,
    );
    let expiry_slot = client.get_slot()?.saturating_add(10_000_000);
    let matcher_signature = send(
        &client,
        &payer,
        &[
            system_instruction::create_account(
                &payer.pubkey(),
                &context.pubkey(),
                client.get_minimum_balance_for_rent_exemption(MATCHER_CONTEXT_LEN)?,
                MATCHER_CONTEXT_LEN as u64,
                &matcher,
            ),
            Instruction {
                program_id: matcher,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new_readonly(delegate, false),
                    AccountMeta::new(context.pubkey(), false),
                    AccountMeta::new_readonly(percolator, false),
                    AccountMeta::new_readonly(market, false),
                    AccountMeta::new_readonly(portfolio.pubkey(), false),
                ],
                data: matcher_init_data(expiry_slot, close_time),
            },
        ],
        &[&context],
    )
    .context("initialize the automatic Moxie matcher")?;

    let portfolio_account = client.get_account(&portfolio.pubkey())?;
    let sequence = state::read_portfolio_matcher_sequence(&portfolio_account.data)?;
    let binding_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id: percolator,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new_readonly(market, false),
                    AccountMeta::new(portfolio.pubkey(), false),
                    AccountMeta::new_readonly(matcher, false),
                    AccountMeta::new_readonly(context.pubkey(), false),
                    AccountMeta::new_readonly(delegate, false),
                ],
                data: PercolatorInstruction::SetMatcherConfig {
                    portfolio_id,
                    expected_sequence: sequence,
                    enabled: 1,
                    trade_fee_cap_bps: 500,
                    expiry_slot,
                }
                .encode(),
            },
        ],
        &[],
    )
    .context("bind the LP portfolio to the matcher")?;

    let receipt = Receipt {
        cluster: "devnet",
        owner: payer.pubkey().to_string(),
        market_account: market.to_string(),
        lp_portfolio: portfolio.pubkey().to_string(),
        matcher_context: context.pubkey().to_string(),
        matcher_delegate: delegate.to_string(),
        collateral_mint: mint.to_string(),
        collateral_deposited_e6: env_or("MOXIE_LP_DEPOSIT_E6", DEFAULT_LP_DEPOSIT_E6),
        matcher_expiry_slot: expiry_slot,
        portfolio_signature: portfolio_signature.to_string(),
        deposit_signature: deposit_signature.to_string(),
        matcher_signature: matcher_signature.to_string(),
        binding_signature: binding_signature.to_string(),
    };
    fs::write(
        &args[9],
        format!("{}\n", serde_json::to_string_pretty(&receipt)?),
    )?;
    println!(
        "seeded LP portfolio {} with {} E6 collateral",
        receipt.lp_portfolio, env_or("MOXIE_LP_DEPOSIT_E6", DEFAULT_LP_DEPOSIT_E6)
    );
    println!("matcher context {}", receipt.matcher_context);
    Ok(())
}
