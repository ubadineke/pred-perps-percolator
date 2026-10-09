use anyhow::{bail, Context, Result};
use percolator_prog::state;
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    compute_budget::ComputeBudgetInstruction,
    hash::hash,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, Keypair, Signature, Signer},
    system_program,
    transaction::Transaction,
};
use std::{env, fs, str::FromStr};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedMarketManifest {
    provider: String,
    underlying_provider: String,
    provider_event_id: String,
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
struct ImportReceipt {
    cluster: &'static str,
    market_account: String,
    oracle_config: String,
    record: String,
    provider_market_id: String,
    title: String,
    asset_index: u16,
    market_id: u64,
    initial_mark_e6: u64,
    close_time: i64,
    activation_signature: String,
    observation_signature: String,
}

fn send(client: &RpcClient, payer: &Keypair, instructions: &[Instruction]) -> Result<Signature> {
    let tx = Transaction::new_signed_with_payer(
        instructions,
        Some(&payer.pubkey()),
        &[payer],
        client.get_latest_blockhash()?,
    );
    client
        .send_and_confirm_transaction(&tx)
        .map_err(|error| anyhow::anyhow!("{error:?}"))
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 8 {
        bail!("usage: import_market <rpc-url> <percolator-program> <oracle-program> <market-account> <payer-keypair> <manifest> <receipt-output>");
    }
    let client = RpcClient::new_with_commitment(args[1].clone(), CommitmentConfig::confirmed());
    let percolator_program = Pubkey::from_str(&args[2])?;
    let oracle_program = Pubkey::from_str(&args[3])?;
    let market_account = Pubkey::from_str(&args[4])?;
    let payer = read_keypair_file(&args[5]).map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let manifest: ImportedMarketManifest = serde_json::from_slice(&fs::read(&args[6])?)?;

    if manifest.initial_mark_e6 == 0 || manifest.initial_mark_e6 >= 1_000_000 {
        bail!("initial mark must be strictly inside the binary price bounds");
    }
    let close_time = i64::try_from(manifest.close_time_ms / 1_000)?;
    let now = client.get_block_time(client.get_slot()?)?;
    if close_time <= now + 15 * 60 {
        bail!("market closes too soon for safe activation");
    }

    let market_data = client.get_account(&market_account)?.data;
    let (_, group) = state::read_market(&market_data)?;
    let market_id = group.next_market_id;
    let asset_index = u16::try_from(
        market_id
            .checked_sub(1)
            .context("invalid market frontier")?,
    )?;
    if usize::from(asset_index) >= group.assets.len() {
        bail!("market account has no remaining asset capacity");
    }

    let (oracle_config, _) =
        Pubkey::find_program_address(&[b"config", market_account.as_ref()], &oracle_program);
    let external_hash = hash(manifest.provider_market_id.as_bytes()).to_bytes();
    let (record, _) = Pubkey::find_program_address(
        &[b"imported", oracle_config.as_ref(), &external_hash],
        &oracle_program,
    );
    if client.get_account(&record).is_ok() {
        bail!("provider market is already imported at {record}");
    }

    let restricted_at = close_time.saturating_sub(30 * 60);
    let reduce_only_at = close_time.saturating_sub(10 * 60);
    // The engine must be flat before the provider stops trading; settlement follows
    // the external venue's resolution separately.
    let hard_flat_at = close_time.saturating_sub(60);
    let mut activation = vec![5u8];
    for value in [
        manifest.provider_market_id.as_str(),
        manifest.yes_asset_id.as_str(),
        manifest.no_asset_id.as_str(),
        manifest.title.as_str(),
        manifest.rules.as_str(),
    ] {
        activation.extend_from_slice(hash(value.as_bytes()).as_ref());
    }
    activation.extend_from_slice(&close_time.to_le_bytes());
    activation.extend_from_slice(&asset_index.to_le_bytes());
    activation.extend_from_slice(&market_id.to_le_bytes());
    activation.extend_from_slice(&manifest.initial_mark_e6.to_le_bytes());
    activation.extend_from_slice(&0u64.to_le_bytes());
    activation.extend_from_slice(&restricted_at.to_le_bytes());
    activation.extend_from_slice(&reduce_only_at.to_le_bytes());
    activation.extend_from_slice(&hard_flat_at.to_le_bytes());

    let activation_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id: oracle_program,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new_readonly(oracle_config, false),
                    AccountMeta::new(record, false),
                    AccountMeta::new(market_account, false),
                    AccountMeta::new_readonly(percolator_program, false),
                    AccountMeta::new_readonly(system_program::id(), false),
                ],
                data: activation,
            },
        ],
    )
    .context("activate imported Jupiter market")?;

    let source_timestamp = client.get_block_time(client.get_slot()?)?;
    let mark = manifest.initial_mark_e6;
    let mut observation = vec![4u8];
    observation.extend_from_slice(&external_hash);
    observation.extend_from_slice(hash(manifest.rules.as_bytes()).as_ref());
    observation.extend_from_slice(&asset_index.to_le_bytes());
    observation.extend_from_slice(&market_id.to_le_bytes());
    observation.extend_from_slice(&mark.to_le_bytes());
    observation.extend_from_slice(&mark.saturating_sub(5_000).max(1_000).to_le_bytes());
    observation.extend_from_slice(&mark.saturating_add(5_000).min(999_000).to_le_bytes());
    observation.extend_from_slice(&mark.saturating_sub(4_000).max(1_000).to_le_bytes());
    observation.extend_from_slice(&mark.saturating_add(4_000).min(999_000).to_le_bytes());
    observation.extend_from_slice(&mark.to_le_bytes());
    observation.extend_from_slice(&0i64.to_le_bytes());
    observation.extend_from_slice(&source_timestamp.to_le_bytes());
    observation.extend_from_slice(&2u64.to_le_bytes());
    observation.push(1);

    let observation_signature = send(
        &client,
        &payer,
        &[
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
            Instruction {
                program_id: oracle_program,
                accounts: vec![
                    AccountMeta::new_readonly(payer.pubkey(), true),
                    AccountMeta::new_readonly(oracle_config, false),
                    AccountMeta::new(record, false),
                    AccountMeta::new(market_account, false),
                    AccountMeta::new_readonly(percolator_program, false),
                ],
                data: observation,
            },
        ],
    )
    .context("submit initial prediction-market pricing observation")?;

    let receipt = ImportReceipt {
        cluster: "devnet",
        market_account: market_account.to_string(),
        oracle_config: oracle_config.to_string(),
        record: record.to_string(),
        provider_market_id: manifest.provider_market_id,
        title: manifest.title,
        asset_index,
        market_id,
        initial_mark_e6: mark,
        close_time,
        activation_signature: activation_signature.to_string(),
        observation_signature: observation_signature.to_string(),
    };
    fs::write(
        &args[7],
        format!("{}\n", serde_json::to_string_pretty(&receipt)?),
    )?;
    println!(
        "imported {} as asset {} / market {}",
        receipt.provider_market_id, asset_index, market_id
    );
    println!("record {}", record);
    Ok(())
}
