//! Funding conservation audit for one asset: catches the asset up, refreshes
//! every listed portfolio inside one transaction (one slot, so every account
//! settles the same accrual), then sums lifetime funding paid vs received.
//! Submits permissionless cranks only.
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
use std::{env, time::Duration};

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 7 {
        bail!("usage: funding_audit <rpc-url> <percolator> <market> <asset-index> <payer-keypair> <portfolio>...");
    }
    let client = RpcClient::new_with_timeout_and_commitment(
        args[1].clone(),
        Duration::from_secs(60),
        CommitmentConfig::confirmed(),
    );
    let program: Pubkey = args[2].parse()?;
    let market: Pubkey = args[3].parse()?;
    let asset_index: u16 = args[4].parse()?;
    let payer = read_keypair_file(&args[5]).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let portfolios: Vec<Pubkey> = args[6..].iter().map(|a| a.parse()).collect::<Result<_, _>>()?;
    let owner_of = |p: &Pubkey| -> Result<Pubkey> {
        Ok(Pubkey::new_from_array(
            state::read_portfolio_owner_preflight(&client.get_account_data(p)?)?.1,
        ))
    };
    let crank = |owner: Pubkey, portfolio: Pubkey| Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new_readonly(owner, false),
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
    };
    let budget = || {
        vec![
            ComputeBudgetInstruction::request_heap_frame(128 * 1024),
            ComputeBudgetInstruction::set_compute_unit_limit(1_400_000),
        ]
    };
    let send = |instructions: Vec<Instruction>| -> Result<()> {
        let tx = Transaction::new_signed_with_payer(
            &instructions,
            Some(&payer.pubkey()),
            &[&payer],
            client.get_latest_blockhash()?,
        );
        client
            .send_and_confirm_transaction(&tx)
            .map(|_| ())
            .map_err(|e| anyhow::anyhow!("{e:?}"))
    };
    let owners: Vec<Pubkey> = portfolios.iter().map(owner_of).collect::<Result<_>>()?;

    // 1. Bulk catch-up on the first portfolio until the asset is near the live slot.
    let mut advance: u64 = 16;
    let mut previous: Option<(u64, u64)> = None;
    for _ in 0..400 {
        let (_, group) = state::read_market(&client.get_account_data(&market)?)?;
        let slot_last = group.assets[asset_index as usize].slot_last;
        if let Some((last, count)) = previous.take() {
            if slot_last > last {
                advance = ((slot_last - last) / count).max(1);
            }
        }
        let lag = client.get_slot()?.saturating_sub(slot_last);
        if lag <= advance * 2 {
            break;
        }
        let count = (lag / advance).saturating_sub(1).clamp(1, 8);
        let mut ix = budget();
        ix.extend((0..count).map(|_| crank(owners[0], portfolios[0])));
        match send(ix) {
            Ok(()) => previous = Some((slot_last, count)),
            Err(e) if e.to_string().contains("Custom(22)") => advance = advance.saturating_mul(2),
            Err(e) => return Err(e),
        }
    }
    // 2. One transaction: the first crank reaches the live slot; each later crank
    //    refreshes a different portfolio at that same slot.
    let mut settled = false;
    for _ in 0..20 {
        let mut ix = budget();
        ix.extend(portfolios.iter().zip(&owners).map(|(p, o)| crank(*o, *p)));
        match send(ix) {
            Ok(()) => {
                settled = true;
                break;
            }
            Err(e) => eprintln!("same-slot settle retry: {}", &e.to_string()[..e.to_string().len().min(160)]),
        }
    }
    if !settled {
        bail!("could not settle every portfolio in one slot");
    }
    // 3. Sum lifetime funding counters.
    let (mut paid, mut received) = (0u128, 0u128);
    for p in &portfolios {
        let pf = state::read_portfolio(&client.get_account_data(p)?)?;
        let (lp, lr, sp, sr) = (
            pf.funding_long_paid_atoms_total.get(),
            pf.funding_long_received_atoms_total.get(),
            pf.funding_short_paid_atoms_total.get(),
            pf.funding_short_received_atoms_total.get(),
        );
        println!("{p}: long paid/recv {lp}/{lr}  short paid/recv {sp}/{sr}");
        paid += lp + sp;
        received += lr + sr;
    }
    println!("TOTAL paid={paid} received={received} difference={}", received as i128 - paid as i128);
    Ok(())
}
