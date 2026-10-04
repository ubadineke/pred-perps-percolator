use anyhow::{bail, Result};
use percolator_prog::state;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Keypair, Signer},
    transaction::Transaction,
};
use std::{env, str::FromStr};

fn snapshot(client: &RpcClient, address: &Pubkey, asset_index: usize) -> Result<(u64, u64, i128)> {
    let account = client.get_account(address)?;
    let portfolio = state::read_portfolio(&account.data)?;
    let position = portfolio
        .legs
        .iter()
        .filter_map(|wire| wire.try_to_runtime().ok())
        .find(|leg| leg.active && leg.asset_index as usize == asset_index)
        .map(|leg| leg.basis_pos_q)
        .unwrap_or_default();
    Ok((
        state::read_portfolio_id(&account.data)?,
        state::read_portfolio_position_epoch(&account.data)?,
        position,
    ))
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 10 {
        bail!("usage: hard_flat_pair <rpc-url> <oracle-program> <percolator-program> <market> <record> <asset-index> <portfolio-a> <portfolio-b> <payer>");
    }
    let client = RpcClient::new_with_commitment(args[1].clone(), CommitmentConfig::confirmed());
    let oracle_program = Pubkey::from_str(&args[2])?;
    let percolator_program = Pubkey::from_str(&args[3])?;
    let market = Pubkey::from_str(&args[4])?;
    let record = Pubkey::from_str(&args[5])?;
    let asset_index: usize = args[6].parse()?;
    let portfolio_a = Pubkey::from_str(&args[7])?;
    let portfolio_b = Pubkey::from_str(&args[8])?;
    let payer: Keypair = read_keypair_file(&args[9]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let (config, _) = Pubkey::find_program_address(&[b"config", market.as_ref()], &oracle_program);
    let (a_id, a_epoch, a_position) = snapshot(&client, &portfolio_a, asset_index)?;
    let (b_id, b_epoch, b_position) = snapshot(&client, &portfolio_b, asset_index)?;
    if a_position == 0 || a_position != -b_position {
        bail!("portfolios do not contain an equal-and-opposite position pair");
    }
    let reduce_q = a_position.unsigned_abs();
    let mut data = vec![7u8];
    data.extend_from_slice(&a_id.to_le_bytes());
    data.extend_from_slice(&a_epoch.to_le_bytes());
    data.extend_from_slice(&b_id.to_le_bytes());
    data.extend_from_slice(&b_epoch.to_le_bytes());
    data.extend_from_slice(&reduce_q.to_le_bytes());
    let ix = Instruction {
        program_id: oracle_program,
        accounts: vec![
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(record, false),
            AccountMeta::new(market, false),
            AccountMeta::new(portfolio_a, false),
            AccountMeta::new(portfolio_b, false),
            AccountMeta::new_readonly(percolator_program, false),
        ],
        data,
    };
    let tx = Transaction::new_signed_with_payer(
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            ix,
        ],
        Some(&payer.pubkey()),
        &[&payer],
        client.get_latest_blockhash()?,
    );
    let signature = client
        .send_and_confirm_transaction(&tx)
        .map_err(|error| anyhow::anyhow!("{error:?}"))?;
    println!("hard-flat {} units: {}", reduce_q, signature);
    Ok(())
}
