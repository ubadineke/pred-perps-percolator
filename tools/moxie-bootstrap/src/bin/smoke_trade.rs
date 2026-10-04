use anyhow::{bail, Context, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use serde::{Deserialize, Serialize};
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

const TRADER_DEPOSIT_E6: u64 = 100_000_000;
const TEST_SIZE_Q: i128 = 1_000_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LiquidityReceipt {
    lp_portfolio: String,
    matcher_context: String,
    matcher_delegate: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SmokeReceipt {
    cluster: &'static str,
    market_account: String,
    trader: String,
    trader_portfolio: String,
    lp_portfolio: String,
    asset_index: u16,
    market_id: u64,
    size_q: i128,
    deposit_signature: String,
    long_open_signature: String,
    long_close_signature: String,
    short_open_signature: String,
    short_close_signature: String,
    trader_final_position_q: i128,
    lp_final_position_q: i128,
}

fn send(client: &RpcClient, payer: &Keypair, ixs: &[Instruction], extra: &[&Keypair]) -> Result<Signature> {
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

fn snapshot(client: &RpcClient, address: &Pubkey) -> Result<(u64, u64, u64)> {
    let data = client.get_account(address)?.data;
    Ok((
        state::read_portfolio_id(&data)?,
        state::read_portfolio_position_epoch(&data)?,
        state::read_portfolio_matcher_sequence(&data)?,
    ))
}

fn position(client: &RpcClient, address: &Pubkey, asset_index: usize) -> Result<i128> {
    let data = client.get_account(address)?.data;
    let portfolio = state::read_portfolio(&data)?;
    for wire in &portfolio.legs {
        let leg = wire.try_to_runtime().map_err(|error| anyhow::anyhow!("invalid leg: {error:?}"))?;
        if leg.active && leg.asset_index as usize == asset_index {
            return Ok(leg.basis_pos_q);
        }
    }
    Ok(0)
}

struct TradeAccounts {
    percolator: Pubkey,
    matcher: Pubkey,
    market: Pubkey,
    trader_portfolio: Pubkey,
    lp_portfolio: Pubkey,
    matcher_context: Pubkey,
    matcher_delegate: Pubkey,
    asset_index: u16,
    market_id: u64,
}

fn trade(client: &RpcClient, payer: &Keypair, a: &TradeAccounts, size_q: i128, limit_price: u64) -> Result<Signature> {
    let (trader_id, trader_epoch, _) = snapshot(client, &a.trader_portfolio)?;
    let (lp_id, lp_epoch, lp_sequence) = snapshot(client, &a.lp_portfolio)?;
    send(
        client,
        payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id: a.percolator,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(a.market, false),
                    AccountMeta::new(a.trader_portfolio, false),
                    AccountMeta::new(a.lp_portfolio, false),
                    AccountMeta::new_readonly(a.matcher, false),
                    AccountMeta::new(a.matcher_context, false),
                    AccountMeta::new_readonly(a.matcher_delegate, false),
                ],
                data: PercolatorInstruction::TradeCpi {
                    account_a_portfolio_id: trader_id,
                    account_a_position_epoch: trader_epoch,
                    account_b_portfolio_id: lp_id,
                    account_b_position_epoch: lp_epoch,
                    account_b_matcher_sequence: lp_sequence,
                    asset_index: a.asset_index,
                    market_id: a.market_id,
                    size_q,
                    fee_bps: 30,
                    limit_price,
                    backing_fee_cap_bps: 0,
                }
                .encode(),
            },
        ],
        &[],
    )
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 13 {
        bail!("usage: smoke_trade <rpc-url> <percolator-program> <matcher-program> <market-account> <collateral-mint> <collateral-vault> <payer-keypair> <liquidity-receipt> <asset-index> <market-id> <mark-e6> <receipt-output>");
    }
    let client = RpcClient::new_with_commitment(args[1].clone(), CommitmentConfig::confirmed());
    let percolator: Pubkey = args[2].parse()?;
    let matcher: Pubkey = args[3].parse()?;
    let market: Pubkey = args[4].parse()?;
    let mint: Pubkey = args[5].parse()?;
    let vault: Pubkey = args[6].parse()?;
    let payer = read_keypair_file(&args[7]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let liquidity: LiquidityReceipt = serde_json::from_slice(&fs::read(&args[8])?)?;
    let asset_index: u16 = args[9].parse()?;
    let market_id: u64 = args[10].parse()?;
    let mark: u64 = args[11].parse()?;
    let lp_portfolio: Pubkey = liquidity.lp_portfolio.parse()?;
    let matcher_context: Pubkey = liquidity.matcher_context.parse()?;
    let matcher_delegate: Pubkey = liquidity.matcher_delegate.parse()?;

    let market_data = client.get_account(&market)?.data;
    let (_, group) = state::read_market(&market_data)?;
    let portfolio_len = state::portfolio_account_len_for_market_slots(group.assets.len())?;
    let trader_portfolio = Keypair::new();
    send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            system_instruction::create_account(
                &payer.pubkey(),
                &trader_portfolio.pubkey(),
                client.get_minimum_balance_for_rent_exemption(portfolio_len)?,
                portfolio_len as u64,
                &percolator,
            ),
            Instruction {
                program_id: percolator,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new(market, false),
                    AccountMeta::new(trader_portfolio.pubkey(), false),
                ],
                data: PercolatorInstruction::InitPortfolio.encode(),
            },
        ],
        &[&trader_portfolio],
    )
    .context("create disposable trader portfolio")?;

    let source = get_associated_token_address_with_program_id(&payer.pubkey(), &mint, &spl_token::id());
    let mut funding = Vec::new();
    if client.get_account(&source).is_err() {
        funding.push(create_associated_token_account(&payer.pubkey(), &payer.pubkey(), &mint, &spl_token::id()));
    }
    funding.push(spl_token::instruction::mint_to(
        &spl_token::id(), &mint, &source, &payer.pubkey(), &[], TRADER_DEPOSIT_E6,
    )?);
    send(&client, &payer, &funding, &[]).context("mint disposable devnet trader collateral")?;
    let (trader_id, _, trader_sequence) = snapshot(&client, &trader_portfolio.pubkey())?;
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
                    AccountMeta::new(trader_portfolio.pubkey(), false),
                    AccountMeta::new(source, false),
                    AccountMeta::new(vault, false),
                    AccountMeta::new_readonly(spl_token::id(), false),
                ],
                data: PercolatorInstruction::Deposit {
                    portfolio_id: trader_id,
                    expected_sequence: trader_sequence,
                    amount: u128::from(TRADER_DEPOSIT_E6),
                }
                .encode(),
            },
        ],
        &[],
    )?;

    for portfolio in [trader_portfolio.pubkey(), lp_portfolio] {
        send(
            &client,
            &payer,
            &[
                ComputeBudgetInstruction::request_heap_frame(128 * 1024),
                ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
                Instruction {
                    program_id: percolator,
                    accounts: vec![
                        AccountMeta::new_readonly(payer.pubkey(), false),
                        AccountMeta::new(market, false),
                        AccountMeta::new(portfolio, false),
                    ],
                    data: PercolatorInstruction::PermissionlessCrank {
                        now_slot: 0,
                        observations: vec![percolator_prog::ix::CrankObservationHint {
                            asset_index,
                            oracle_accounts: 0,
                        }],
                    }
                    .encode(),
                },
            ],
            &[],
        )?;
    }

    let accounts = TradeAccounts {
        percolator, matcher, market,
        trader_portfolio: trader_portfolio.pubkey(),
        lp_portfolio, matcher_context, matcher_delegate,
        asset_index, market_id,
    };
    let buy_limit = mark.saturating_add(100_000).min(999_999);
    let sell_limit = mark.saturating_sub(100_000).max(1);
    let long_open_signature = trade(&client, &payer, &accounts, TEST_SIZE_Q, buy_limit)
        .context("open long")?;
    let long_close_signature = trade(&client, &payer, &accounts, -TEST_SIZE_Q, sell_limit)
        .context("close long")?;
    let short_open_signature = trade(&client, &payer, &accounts, -TEST_SIZE_Q, sell_limit)
        .context("open short")?;
    let short_close_signature = trade(&client, &payer, &accounts, TEST_SIZE_Q, buy_limit)
        .context("close short")?;

    let trader_final_position_q = position(&client, &trader_portfolio.pubkey(), usize::from(asset_index))?;
    let lp_final_position_q = position(&client, &lp_portfolio, usize::from(asset_index))?;
    if trader_final_position_q != 0 || lp_final_position_q != 0 {
        bail!("round trip did not flatten: trader={trader_final_position_q}, lp={lp_final_position_q}");
    }

    let receipt = SmokeReceipt {
        cluster: "devnet", market_account: market.to_string(), trader: payer.pubkey().to_string(),
        trader_portfolio: trader_portfolio.pubkey().to_string(), lp_portfolio: lp_portfolio.to_string(),
        asset_index, market_id, size_q: TEST_SIZE_Q, deposit_signature: deposit_signature.to_string(),
        long_open_signature: long_open_signature.to_string(), long_close_signature: long_close_signature.to_string(),
        short_open_signature: short_open_signature.to_string(), short_close_signature: short_close_signature.to_string(),
        trader_final_position_q, lp_final_position_q,
    };
    fs::write(&args[12], format!("{}\n", serde_json::to_string_pretty(&receipt)?))?;
    println!("long and short round trips succeeded; trader and LP are flat");
    println!("trader portfolio {}", receipt.trader_portfolio);
    Ok(())
}
