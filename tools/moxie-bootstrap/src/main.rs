use anyhow::{bail, Context, Result};
use percolator_prog::{ix::Instruction as PercolatorInstruction, state};
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    hash::hash,
    instruction::{AccountMeta, Instruction},
    program_pack::Pack,
    pubkey::Pubkey,
    signature::{read_keypair_file, write_keypair_file, Keypair, Signature, Signer},
    system_instruction,
    transaction::Transaction,
};
use spl_associated_token_account::{
    get_associated_token_address_with_program_id, instruction::create_associated_token_account,
};
use std::{env, fs, path::Path, thread, time::Duration};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketGroupConfig {
    name: String,
    quote: QuoteConfig,
    portfolio: PortfolioConfig,
    price: PriceConfig,
    risk: RiskConfig,
}

#[derive(Deserialize)]
struct QuoteConfig {
    decimals: u8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortfolioConfig {
    max_assets: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PriceConfig {
    initial_e6: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RiskConfig {
    maintenance_margin_bps: u64,
    initial_margin_bps: u64,
    max_trading_fee_bps: u64,
    trade_fee_base_bps: u64,
    liquidation_fee_bps: u64,
    max_price_move_bps_per_slot: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportedMarketManifest {
    provider_market_id: String,
    title: String,
    rules: String,
    yes_asset_id: String,
    no_asset_id: String,
    close_time_ms: u64,
    initial_mark_e6: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Deployment {
    cluster: &'static str,
    rpc_url: String,
    percolator_program_id: String,
    matcher_program_id: String,
    oracle_program_id: String,
    oracle_config: String,
    usdc_mint: String,
    market_account: String,
    market_authority: String,
    vault_authority: String,
    collateral_vault: String,
    market_group_name: String,
    imported_markets: Vec<ImportedDeployment>,
    engine_demo: EngineDemoDeployment,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineDemoDeployment {
    trader: String,
    trader_portfolio: String,
    lp: String,
    lp_portfolio: String,
    matcher_context: String,
    matcher_delegate: String,
    trade_signature: String,
    asset_index: u16,
    market_id: u64,
    size_q: i128,
    trader_position_q: i128,
    lp_position_q: i128,
    slippage_rejection_proven: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedDeployment {
    provider_market_id: String,
    asset_index: u16,
    market_id: u64,
    record: String,
    initial_mark_e6: u64,
}

fn send(
    client: &RpcClient,
    payer: &Keypair,
    instructions: &[Instruction],
    extra: &[&Keypair],
) -> Result<Signature> {
    let blockhash = client.get_latest_blockhash()?;
    let mut signers = vec![payer];
    signers.extend_from_slice(extra);
    let tx = Transaction::new_signed_with_payer(
        instructions,
        Some(&payer.pubkey()),
        &signers,
        blockhash,
    );
    let signature = client
        .send_and_confirm_transaction(&tx)
        .map_err(|error| anyhow::anyhow!("{error:?}"))?;
    Ok(signature)
}

fn portfolio_snapshot(client: &RpcClient, address: &Pubkey) -> Result<(u64, u64, u64)> {
    let account = client.get_account(address)?;
    Ok((
        state::read_portfolio_id(&account.data)?,
        state::read_portfolio_position_epoch(&account.data)?,
        state::read_portfolio_matcher_sequence(&account.data)?,
    ))
}

fn position_q(client: &RpcClient, address: &Pubkey, asset_index: usize) -> Result<i128> {
    let account = client.get_account(address)?;
    let portfolio = state::read_portfolio(&account.data)?;
    for wire in &portfolio.legs {
        let leg = wire
            .try_to_runtime()
            .map_err(|error| anyhow::anyhow!("invalid portfolio leg: {error:?}"))?;
        if leg.active && leg.asset_index as usize == asset_index {
            return Ok(leg.basis_pos_q);
        }
    }
    Ok(0)
}

fn matcher_init_data(delegate: &Pubkey, expiry_slot: u64) -> Vec<u8> {
    let mut data = vec![2u8];
    for value in [30u32, 500, 100, 80, 10, 10] {
        data.extend_from_slice(&value.to_le_bytes());
    }
    data.extend_from_slice(&expiry_slot.to_le_bytes());
    data.extend_from_slice(&1_000_000_000u128.to_le_bytes());
    data.extend_from_slice(&10_000_000u128.to_le_bytes());
    data.extend_from_slice(&100_000_000u128.to_le_bytes());
    debug_assert_eq!(data.len(), 81);
    let _ = delegate;
    data
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 7 || args.len() > 9 {
        bail!("usage: moxie-bootstrap <rpc-url> <percolator-keypair> <matcher-keypair> <oracle-keypair> <market-config> <deployment-output> [payer-keypair] [imported-market-manifest]");
    }
    let rpc_url = args[1].clone();
    let program_keypair =
        read_keypair_file(&args[2]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let program_id = program_keypair.pubkey();
    let matcher_keypair =
        read_keypair_file(&args[3]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let matcher_program_id = matcher_keypair.pubkey();
    let oracle_keypair =
        read_keypair_file(&args[4]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let oracle_program_id = oracle_keypair.pubkey();
    let config: MarketGroupConfig = serde_json::from_slice(&fs::read(&args[5])?)?;
    if config.quote.decimals != 6 {
        bail!("V1 collateral mint must use 6 decimals");
    }

    let payer_path = args
        .get(7)
        .cloned()
        .unwrap_or_else(|| expand_home("~/.config/solana/id.json"));
    let payer =
        read_keypair_file(&payer_path).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let client = RpcClient::new_with_commitment(rpc_url.clone(), CommitmentConfig::confirmed());
    println!(
        "bootstrap payer {} balance {} lamports",
        payer.pubkey(),
        client.get_balance(&payer.pubkey())?
    );

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
    .context("create mock USDC mint")?;

    let market = Keypair::new();
    let market_len = state::market_account_len_for_capacity(config.portfolio.max_assets as usize)?;
    let market_rent = client.get_minimum_balance_for_rent_exemption(market_len)?;
    let init = PercolatorInstruction::InitMarket {
        // Start with Percolator's base slot only. The account has capacity for the
        // configured portfolio width; controlled activation appends imported assets.
        max_portfolio_assets: 1,
        h_min: 0,
        h_max: 10,
        initial_price: config.price.initial_e6,
        min_nonzero_mm_req: 1,
        min_nonzero_im_req: 2,
        maintenance_margin_bps: config.risk.maintenance_margin_bps,
        initial_margin_bps: config.risk.initial_margin_bps,
        max_trading_fee_bps: config.risk.max_trading_fee_bps,
        trade_fee_base_bps: config.risk.trade_fee_base_bps,
        liquidation_fee_bps: config.risk.liquidation_fee_bps,
        liquidation_fee_cap: 0,
        min_liquidation_abs: 0,
        // Preserve a full 100% authenticated move across the bounded 100-slot
        // catch-up envelope while satisfying Percolator's 1x solvency proof.
        max_price_move_bps_per_slot: config.risk.max_price_move_bps_per_slot / 100,
        // Bootstrap and provider reporting span multiple validator slots; cap catch-up
        // without requiring every control transaction to land in the immediately next slot.
        max_accrual_dt_slots: 100,
        max_abs_funding_e9_per_slot: 0,
        min_funding_lifetime_slots: 100,
        max_account_b_settlement_chunks: 1,
        max_bankrupt_close_chunks: 1,
        max_bankrupt_close_lifetime_slots: 100,
        public_b_chunk_atoms: 10_000_000_000_000_000,
        maintenance_fee_per_slot: 0,
    };
    send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            system_instruction::create_account(
                &payer.pubkey(),
                &market.pubkey(),
                market_rent,
                market_len as u64,
                &program_id,
            ),
            Instruction {
                program_id,
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
    .context("create and initialize Percolator market group")?;

    let (vault_authority, _) =
        Pubkey::find_program_address(&[b"vault", market.pubkey().as_ref()], &program_id);
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
    )
    .context("create canonical collateral vault")?;

    // Phase 6: bind this Percolator group to the authenticated reporter adapter.
    let (oracle_config, _) =
        Pubkey::find_program_address(&[b"config", market.pubkey().as_ref()], &oracle_program_id);
    let mut init_oracle = vec![0u8];
    init_oracle.extend_from_slice(payer.pubkey().as_ref());
    init_oracle.extend_from_slice(&30u64.to_le_bytes());
    send(
        &client,
        &payer,
        &[Instruction {
            program_id: oracle_program_id,
            accounts: vec![
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new(oracle_config, false),
                AccountMeta::new_readonly(program_id, false),
                AccountMeta::new(market.pubkey(), false),
                AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
            ],
            data: init_oracle,
        }],
        &[],
    )
    .context("initialize Moxie oracle policy")?;

    let market_account = client.get_account(&market.pubkey())?;
    let (_, initialized_group) = state::read_market(&market_account.data)?;
    println!(
        "market frontier next_id={} current_slot={} configured_assets={}",
        initialized_group.next_market_id,
        initialized_group.current_slot,
        initialized_group.assets.len()
    );

    // These are normalized provider fixtures, not Moxie-originated events. Each immutable
    // record activates one independent Percolator asset generation in the shared group.
    let demos = if let Some(path) = args.get(8) {
        let live: ImportedMarketManifest = serde_json::from_slice(&fs::read(path)?)?;
        vec![(
            live.provider_market_id,
            live.yes_asset_id,
            live.no_asset_id,
            live.title,
            live.rules,
            live.close_time_ms,
            live.initial_mark_e6,
        )]
    } else {
        vec![(
            "jup-sol-250-friday".to_owned(),
            "yes-sol-250".to_owned(),
            "no-sol-250".to_owned(),
            "Will SOL close above $250 Friday?".to_owned(),
            "Jupiter provider rules v1".to_owned(),
            2_000_000_000_000,
            550_000u64,
        )]
    };
    let mut imported_markets = Vec::new();
    let mut previous_activation_slot = client.get_slot()?;
    for (offset, (external_id, yes_id, no_id, title, rules, close_time_ms, mark)) in
        demos.iter().enumerate()
    {
        let asset_index = (offset + 1) as u16;
        // InitMarket creates generation 1 at asset 0; appended imported assets consume
        // the monotonically increasing frontier beginning at generation 2.
        let market_id = initialized_group.next_market_id + offset as u64;
        let external_hash = hash(external_id.as_bytes()).to_bytes();
        let (record, _) = Pubkey::find_program_address(
            &[b"imported", oracle_config.as_ref(), &external_hash],
            &oracle_program_id,
        );
        let slot = wait_for_next_slot(&client, previous_activation_slot)?;
        let mut activation = vec![1u8];
        for value in [external_id, yes_id, no_id, title, rules] {
            activation.extend_from_slice(hash(value.as_bytes()).as_ref());
        }
        activation.extend_from_slice(&((*close_time_ms / 1_000) as i64).to_le_bytes());
        activation.extend_from_slice(&asset_index.to_le_bytes());
        activation.extend_from_slice(&market_id.to_le_bytes());
        activation.extend_from_slice(&mark.to_le_bytes());
        // Zero asks Percolator to authenticate the current Clock slot itself, avoiding
        // commitment-level RPC lag between the client and the executing bank.
        activation.extend_from_slice(&0u64.to_le_bytes());
        send(
            &client,
            &payer,
            &[
                ComputeBudgetInstruction::request_heap_frame(128 * 1024),
                ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
                Instruction {
                    program_id: oracle_program_id,
                    accounts: vec![
                        AccountMeta::new(payer.pubkey(), true),
                        AccountMeta::new_readonly(payer.pubkey(), true),
                        AccountMeta::new_readonly(oracle_config, false),
                        AccountMeta::new(record, false),
                        AccountMeta::new(market.pubkey(), false),
                        AccountMeta::new_readonly(program_id, false),
                        AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
                    ],
                    data: activation,
                },
            ],
            &[],
        )
        .with_context(|| format!("activate imported market {external_id}"))?;
        previous_activation_slot = slot;
        imported_markets.push(ImportedDeployment {
            provider_market_id: external_id.clone(),
            asset_index,
            market_id,
            record: record.to_string(),
            initial_mark_e6: *mark,
        });
    }

    // Phase 8 local proof: two independently-owned, funded margin portfolios execute through
    // Percolator's production TradeCpi path and Moxie's authenticated matcher.
    let trader = Keypair::new();
    let lp = Keypair::new();
    let trader_token = get_associated_token_address_with_program_id(
        &trader.pubkey(),
        &mint.pubkey(),
        &spl_token::id(),
    );
    let lp_token = get_associated_token_address_with_program_id(
        &lp.pubkey(),
        &mint.pubkey(),
        &spl_token::id(),
    );
    send(
        &client,
        &payer,
        &[
            system_instruction::transfer(&payer.pubkey(), &trader.pubkey(), 100_000_000),
            system_instruction::transfer(&payer.pubkey(), &lp.pubkey(), 100_000_000),
            create_associated_token_account(
                &payer.pubkey(),
                &trader.pubkey(),
                &mint.pubkey(),
                &spl_token::id(),
            ),
            create_associated_token_account(
                &payer.pubkey(),
                &lp.pubkey(),
                &mint.pubkey(),
                &spl_token::id(),
            ),
            spl_token::instruction::mint_to(
                &spl_token::id(),
                &mint.pubkey(),
                &trader_token,
                &payer.pubkey(),
                &[],
                100_000_000,
            )?,
            spl_token::instruction::mint_to(
                &spl_token::id(),
                &mint.pubkey(),
                &lp_token,
                &payer.pubkey(),
                &[],
                1_000_000_000,
            )?,
        ],
        &[],
    )
    .context("fund local trader and LP")?;

    let portfolio_len =
        state::portfolio_account_len_for_market_slots(config.portfolio.max_assets as usize)?;
    let portfolio_rent = client.get_minimum_balance_for_rent_exemption(portfolio_len)?;
    let trader_portfolio = Keypair::new();
    let lp_portfolio = Keypair::new();
    for (owner, portfolio) in [(&trader, &trader_portfolio), (&lp, &lp_portfolio)] {
        send(
            &client,
            &payer,
            &[
                ComputeBudgetInstruction::request_heap_frame(128 * 1024),
                ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
                system_instruction::create_account(
                    &payer.pubkey(),
                    &portfolio.pubkey(),
                    portfolio_rent,
                    portfolio_len as u64,
                    &program_id,
                ),
                Instruction {
                    program_id,
                    accounts: vec![
                        AccountMeta::new_readonly(owner.pubkey(), true),
                        AccountMeta::new(market.pubkey(), false),
                        AccountMeta::new(portfolio.pubkey(), false),
                    ],
                    data: PercolatorInstruction::InitPortfolio.encode(),
                },
            ],
            &[owner, portfolio],
        )
        .context("initialize margin portfolio")?;
    }

    for (owner, portfolio, source, amount) in [
        (&trader, &trader_portfolio, trader_token, 100_000_000u128),
        (&lp, &lp_portfolio, lp_token, 1_000_000_000u128),
    ] {
        let (portfolio_id, _, sequence) = portfolio_snapshot(&client, &portfolio.pubkey())?;
        send(
            &client,
            &payer,
            &[
                ComputeBudgetInstruction::request_heap_frame(128 * 1024),
                ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
                Instruction {
                    program_id,
                    accounts: vec![
                        AccountMeta::new_readonly(owner.pubkey(), true),
                        AccountMeta::new(market.pubkey(), false),
                        AccountMeta::new(portfolio.pubkey(), false),
                        AccountMeta::new(source, false),
                        AccountMeta::new(vault, false),
                        AccountMeta::new_readonly(spl_token::id(), false),
                    ],
                    data: PercolatorInstruction::Deposit {
                        portfolio_id,
                        expected_sequence: sequence,
                        amount,
                    }
                    .encode(),
                },
            ],
            &[owner],
        )
        .context("deposit mock USDC margin")?;
    }

    let matcher_context = Keypair::new();
    let matcher_context_len = 320usize;
    let matcher_context_rent =
        client.get_minimum_balance_for_rent_exemption(matcher_context_len)?;
    let (matcher_delegate, _) = Pubkey::find_program_address(
        &[
            b"matcher",
            market.pubkey().as_ref(),
            lp_portfolio.pubkey().as_ref(),
            lp.pubkey().as_ref(),
            matcher_program_id.as_ref(),
            matcher_context.pubkey().as_ref(),
        ],
        &program_id,
    );
    let matcher_expiry = client.get_slot()?.saturating_add(10_000);
    send(
        &client,
        &payer,
        &[
            system_instruction::create_account(
                &payer.pubkey(),
                &matcher_context.pubkey(),
                matcher_context_rent,
                matcher_context_len as u64,
                &matcher_program_id,
            ),
            Instruction {
                program_id: matcher_program_id,
                accounts: vec![
                    AccountMeta::new_readonly(lp.pubkey(), true),
                    AccountMeta::new_readonly(matcher_delegate, false),
                    AccountMeta::new(matcher_context.pubkey(), false),
                    AccountMeta::new_readonly(program_id, false),
                    AccountMeta::new_readonly(market.pubkey(), false),
                    AccountMeta::new_readonly(lp_portfolio.pubkey(), false),
                ],
                data: matcher_init_data(&matcher_delegate, matcher_expiry),
            },
        ],
        &[&lp, &matcher_context],
    )
    .context("initialize Moxie matcher context")?;

    let (lp_id, _, lp_sequence) = portfolio_snapshot(&client, &lp_portfolio.pubkey())?;
    send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id,
                accounts: vec![
                    AccountMeta::new_readonly(lp.pubkey(), true),
                    AccountMeta::new_readonly(market.pubkey(), false),
                    AccountMeta::new(lp_portfolio.pubkey(), false),
                    AccountMeta::new_readonly(matcher_program_id, false),
                    AccountMeta::new_readonly(matcher_context.pubkey(), false),
                    AccountMeta::new_readonly(matcher_delegate, false),
                ],
                data: PercolatorInstruction::SetMatcherConfig {
                    portfolio_id: lp_id,
                    expected_sequence: lp_sequence,
                    enabled: 1,
                    trade_fee_cap_bps: 500,
                    expiry_slot: matcher_expiry,
                }
                .encode(),
            },
        ],
        &[&lp],
    )
    .context("bind LP portfolio to Moxie matcher")?;

    let imported = &imported_markets[0];
    let (trader_id, trader_epoch, _) = portfolio_snapshot(&client, &trader_portfolio.pubkey())?;
    let (lp_id, lp_epoch, lp_sequence) = portfolio_snapshot(&client, &lp_portfolio.pubkey())?;
    let trade_ix = |limit_price| Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(trader.pubkey(), true),
            AccountMeta::new(market.pubkey(), false),
            AccountMeta::new(trader_portfolio.pubkey(), false),
            AccountMeta::new(lp_portfolio.pubkey(), false),
            AccountMeta::new_readonly(matcher_program_id, false),
            AccountMeta::new(matcher_context.pubkey(), false),
            AccountMeta::new_readonly(matcher_delegate, false),
        ],
        data: PercolatorInstruction::TradeCpi {
            account_a_portfolio_id: trader_id,
            account_a_position_epoch: trader_epoch,
            account_b_portfolio_id: lp_id,
            account_b_position_epoch: lp_epoch,
            account_b_matcher_sequence: lp_sequence,
            asset_index: imported.asset_index,
            market_id: imported.market_id,
            size_q: 1_000_000,
            fee_bps: 30,
            limit_price,
            backing_fee_cap_bps: 0,
        }
        .encode(),
    };
    let accepting_limit = imported.initial_mark_e6.saturating_add(50_000).min(999_999);
    let trade_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            trade_ix(accepting_limit),
        ],
        &[&trader],
    )
    .context("execute Percolator TradeCpi through Moxie matcher")?;
    let trader_position_q = position_q(
        &client,
        &trader_portfolio.pubkey(),
        imported.asset_index as usize,
    )?;
    let lp_position_q = position_q(
        &client,
        &lp_portfolio.pubkey(),
        imported.asset_index as usize,
    )?;
    if trader_position_q != 1_000_000 || lp_position_q != -1_000_000 {
        bail!("unexpected post-trade positions: trader={trader_position_q}, lp={lp_position_q}");
    }

    // The same route must reject an ask above the taker's signed limit.
    let slippage_rejection_proven = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            trade_ix(imported.initial_mark_e6),
        ],
        &[&trader],
    )
    .is_err();
    if !slippage_rejection_proven {
        bail!("matcher accepted a trade beyond the taker's limit");
    }

    let engine_demo = EngineDemoDeployment {
        trader: trader.pubkey().to_string(),
        trader_portfolio: trader_portfolio.pubkey().to_string(),
        lp: lp.pubkey().to_string(),
        lp_portfolio: lp_portfolio.pubkey().to_string(),
        matcher_context: matcher_context.pubkey().to_string(),
        matcher_delegate: matcher_delegate.to_string(),
        trade_signature: trade_signature.to_string(),
        asset_index: imported.asset_index,
        market_id: imported.market_id,
        size_q: 1_000_000,
        trader_position_q,
        lp_position_q,
        slippage_rejection_proven,
    };

    let key_path = Path::new("deployments/localnet-market.keypair.json");
    write_keypair_file(&market, key_path).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let deployment = Deployment {
        cluster: "localnet",
        rpc_url,
        percolator_program_id: program_id.to_string(),
        matcher_program_id: matcher_program_id.to_string(),
        oracle_program_id: oracle_program_id.to_string(),
        oracle_config: oracle_config.to_string(),
        usdc_mint: mint.pubkey().to_string(),
        market_account: market.pubkey().to_string(),
        market_authority: payer.pubkey().to_string(),
        vault_authority: vault_authority.to_string(),
        collateral_vault: vault.to_string(),
        market_group_name: config.name,
        imported_markets,
        engine_demo,
    };
    fs::write(&args[6], serde_json::to_vec_pretty(&deployment)?)?;
    println!(
        "initialized market group {} at {}",
        deployment.market_group_name, deployment.market_account
    );
    Ok(())
}

fn expand_home(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home_dir) = env::var("HOME") {
            return format!("{home_dir}/{rest}");
        }
    }
    path.to_owned()
}

fn wait_for_next_slot(client: &RpcClient, previous: u64) -> Result<u64> {
    for _ in 0..50 {
        let slot = client.get_slot()?;
        if slot > previous {
            return Ok(slot);
        }
        thread::sleep(Duration::from_millis(100));
    }
    bail!("local validator did not advance beyond slot {previous}")
}
