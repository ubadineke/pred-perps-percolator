#![no_std]
extern crate alloc;
use alloc::format;
use moxie_probability_math::{valid_live_price, BPS_SCALE};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::Sysvar,
};
#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);
pub const CONTEXT_LEN: usize = 320;
const STATE: usize = 64;
const MAGIC: u64 = 0x4d4f5849454d4d31;
const PRICE_MAX: u64 = 1_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Config {
    pub delegate: Pubkey,
    pub base_spread_e6: u32,
    pub max_total_adjustment_e6: u32,
    pub size_coefficient_e6: u32,
    pub skew_coefficient_e6: u32,
    pub oracle_health_charge_e6: u32,
    pub divergence_charge_e6: u32,
    pub lock_charge_e6: u32,
    pub hedge_charge_e6: u32,
    pub epsilon_e6: u32,
    pub expiry_slot: u64,
    pub liquidity_notional_e6: u128,
    pub max_fill_abs: u128,
    pub max_inventory_abs: u128,
    pub inventory_base: i128,
    pub paused: bool,
}
#[derive(Clone, Copy)]
struct Call {
    req_id: u64,
    asset_index: u16,
    lp_account_id: u64,
    oracle: u64,
    size: i128,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Quote {
    pub exec_price_e6: u64,
    pub exec_size: i128,
    pub next_inventory: i128,
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    match data.first().copied() {
        Some(0) => process_match(program_id, accounts, data),
        Some(2) => process_initialize(program_id, accounts, data),
        Some(4) => process_pause(program_id, accounts, data),
        Some(5) => process_initialize_v2(program_id, accounts, data),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn process_initialize(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 81 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut it = accounts.iter();
    let owner = next_account_info(&mut it)?;
    let delegate = next_account_info(&mut it)?;
    let context = next_account_info(&mut it)?;
    let percolator = next_account_info(&mut it)?;
    let market = next_account_info(&mut it)?;
    let portfolio = next_account_info(&mut it)?;
    if !owner.is_signer || !context.is_writable || context.owner != program_id {
        return Err(ProgramError::InvalidAccountData);
    }
    let (expected, _) = Pubkey::find_program_address(
        &[
            b"matcher",
            market.key.as_ref(),
            portfolio.key.as_ref(),
            owner.key.as_ref(),
            program_id.as_ref(),
            context.key.as_ref(),
        ],
        percolator.key,
    );
    if expected != *delegate.key {
        return Err(ProgramError::InvalidSeeds);
    }
    let mut bytes = context.try_borrow_mut_data()?;
    if bytes.len() != CONTEXT_LEN || read_u64(&bytes, STATE)? != 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    let cfg = Config {
        delegate: *delegate.key,
        // Legacy initializer retained for existing clients. Its historic bps
        // values are conservatively converted to absolute probability e6.
        base_spread_e6: bps_to_e6(read_u32(data, 1)?)?,
        max_total_adjustment_e6: bps_to_e6(read_u32(data, 5)?)?,
        size_coefficient_e6: bps_to_e6(read_u32(data, 9)?)?,
        skew_coefficient_e6: bps_to_e6(read_u32(data, 13)?)?,
        oracle_health_charge_e6: bps_to_e6(read_u32(data, 17)?)?,
        divergence_charge_e6: 0,
        lock_charge_e6: 0,
        hedge_charge_e6: bps_to_e6(read_u32(data, 21)?)?,
        epsilon_e6: 1,
        expiry_slot: read_u64(data, 25)?,
        liquidity_notional_e6: read_u128(data, 33)?,
        max_fill_abs: read_u128(data, 49)?,
        max_inventory_abs: read_u128(data, 65)?,
        inventory_base: 0,
        paused: false,
    };
    validate_config(&cfg)?;
    write_config(&mut bytes, &cfg)
}

fn process_initialize_v2(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if data.len() != 93 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut it = accounts.iter();
    let owner = next_account_info(&mut it)?;
    let delegate = next_account_info(&mut it)?;
    let context = next_account_info(&mut it)?;
    let percolator = next_account_info(&mut it)?;
    let market = next_account_info(&mut it)?;
    let portfolio = next_account_info(&mut it)?;
    if !owner.is_signer || !context.is_writable || context.owner != program_id {
        return Err(ProgramError::InvalidAccountData);
    }
    let (expected, _) = Pubkey::find_program_address(
        &[
            b"matcher",
            market.key.as_ref(),
            portfolio.key.as_ref(),
            owner.key.as_ref(),
            program_id.as_ref(),
            context.key.as_ref(),
        ],
        percolator.key,
    );
    if expected != *delegate.key {
        return Err(ProgramError::InvalidSeeds);
    }
    let mut bytes = context.try_borrow_mut_data()?;
    if bytes.len() != CONTEXT_LEN || read_u64(&bytes, STATE)? != 0 {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    let cfg = Config {
        delegate: *delegate.key,
        base_spread_e6: read_u32(data, 1)?,
        max_total_adjustment_e6: read_u32(data, 5)?,
        size_coefficient_e6: read_u32(data, 9)?,
        skew_coefficient_e6: read_u32(data, 13)?,
        oracle_health_charge_e6: read_u32(data, 17)?,
        divergence_charge_e6: read_u32(data, 21)?,
        lock_charge_e6: read_u32(data, 25)?,
        hedge_charge_e6: read_u32(data, 29)?,
        expiry_slot: read_u64(data, 33)?,
        liquidity_notional_e6: read_u128(data, 41)?,
        max_fill_abs: read_u128(data, 57)?,
        max_inventory_abs: read_u128(data, 73)?,
        epsilon_e6: read_u32(data, 89)?,
        inventory_base: 0,
        paused: false,
    };
    validate_config(&cfg)?;
    write_config(&mut bytes, &cfg)
}
fn process_match(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let call = parse_call(data)?;
    let mut it = accounts.iter();
    let delegate = next_account_info(&mut it)?;
    let context = next_account_info(&mut it)?;
    if !delegate.is_signer || !context.is_writable || context.owner != program_id {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let mut bytes = context.try_borrow_mut_data()?;
    let mut cfg = read_config(&bytes)?;
    if cfg.delegate != *delegate.key {
        return Err(ProgramError::InvalidSeeds);
    }
    match quote(&cfg, call.oracle, call.size, Clock::get()?.slot) {
        Some(fill) => {
            cfg.inventory_base = fill.next_inventory;
            write_config(&mut bytes, &cfg)?;
            write_return(&mut bytes, &call, fill.exec_price_e6, fill.exec_size, false)
        }
        None => write_return(&mut bytes, &call, 1, 0, true),
    }
}
fn process_pause(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 2 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut it = accounts.iter();
    let owner = next_account_info(&mut it)?;
    let context = next_account_info(&mut it)?;
    if !owner.is_signer || !context.is_writable || context.owner != program_id {
        return Err(ProgramError::InvalidAccountData);
    }
    let mut bytes = context.try_borrow_mut_data()?;
    let mut cfg = read_config(&bytes)?;
    cfg.paused = data[1] != 0;
    write_config(&mut bytes, &cfg)
}

/// Deterministic full-fill-or-reject quote. Percolator enforces the signed user limit.
pub fn quote(c: &Config, oracle: u64, requested: i128, slot: u64) -> Option<Quote> {
    if c.paused
        || slot > c.expiry_slot
        || !valid_live_price(oracle, u64::from(c.epsilon_e6))
        || requested == 0
    {
        return None;
    }
    let abs = requested.unsigned_abs();
    if abs > c.max_fill_abs {
        return None;
    }
    let next = c.inventory_base.checked_sub(requested)?;
    if next.unsigned_abs() > c.max_inventory_abs {
        return None;
    }
    let capacity = c.max_inventory_abs;
    let user_exposure_before = c.inventory_base.checked_neg()?;
    let twice_average_exposure = user_exposure_before
        .checked_mul(2)?
        .checked_add(requested)?;
    let inventory_adjustment = twice_average_exposure
        .checked_mul(i128::from(c.skew_coefficient_e6))?
        .checked_div(i128::try_from(capacity.checked_mul(2)?).ok()?)?;
    let size_adjustment = abs
        .checked_mul(u128::from(c.size_coefficient_e6))?
        .checked_add(capacity.checked_sub(1)?)?
        .checked_div(capacity)?;
    let fixed = u128::from(c.base_spread_e6)
        .checked_add(u128::from(c.oracle_health_charge_e6))?
        .checked_add(u128::from(c.divergence_charge_e6))?
        .checked_add(u128::from(c.lock_charge_e6))?
        .checked_add(u128::from(c.hedge_charge_e6))?;
    let side = requested.signum();
    let side_adjustment = i128::try_from(fixed.checked_add(size_adjustment)?)
        .ok()?
        .checked_mul(side)?;
    let raw_adjustment = inventory_adjustment.checked_add(side_adjustment)?;
    let bounded_adjustment = raw_adjustment.clamp(
        -i128::from(c.max_total_adjustment_e6),
        i128::from(c.max_total_adjustment_e6),
    );
    let raw_price = i128::from(oracle).checked_add(bounded_adjustment)?;
    let lower = i128::from(c.epsilon_e6);
    let upper = i128::from(PRICE_MAX.checked_sub(u64::from(c.epsilon_e6))?);
    let price = u64::try_from(raw_price.clamp(lower, upper)).ok()?;
    Some(Quote {
        exec_price_e6: price,
        exec_size: requested,
        next_inventory: next,
    })
}
fn validate_config(c: &Config) -> ProgramResult {
    let fixed = u64::from(c.base_spread_e6)
        + u64::from(c.oracle_health_charge_e6)
        + u64::from(c.divergence_charge_e6)
        + u64::from(c.lock_charge_e6)
        + u64::from(c.hedge_charge_e6);
    if c.epsilon_e6 == 0
        || u64::from(c.epsilon_e6) >= PRICE_MAX / 2
        || c.max_total_adjustment_e6 == 0
        || u64::from(c.max_total_adjustment_e6) >= PRICE_MAX / 2
        || u64::from(c.base_spread_e6) > u64::from(c.max_total_adjustment_e6)
        || fixed > u64::from(c.max_total_adjustment_e6)
        || c.liquidity_notional_e6 == 0
        || c.max_fill_abs == 0
        || c.max_inventory_abs == 0
    {
        Err(ProgramError::InvalidArgument)
    } else {
        Ok(())
    }
}

fn bps_to_e6(bps: u32) -> Result<u32, ProgramError> {
    u64::from(bps)
        .checked_mul(PRICE_MAX)
        .and_then(|value| value.checked_div(BPS_SCALE))
        .and_then(|value| u32::try_from(value).ok())
        .ok_or(ProgramError::InvalidArgument)
}
fn parse_call(d: &[u8]) -> Result<Call, ProgramError> {
    if d.len() != 67 || d[0] != 0 || d[43..].iter().any(|b| *b != 0) {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(Call {
        req_id: read_u64(d, 1)?,
        asset_index: read_u16(d, 9)?,
        lp_account_id: read_u64(d, 11)?,
        oracle: read_u64(d, 19)?,
        size: read_i128(d, 27)?,
    })
}
fn write_return(d: &mut [u8], c: &Call, price: u64, size: i128, rejected: bool) -> ProgramResult {
    if d.len() < 64 {
        return Err(ProgramError::AccountDataTooSmall);
    }
    d[0..4].copy_from_slice(&3u32.to_le_bytes());
    d[4..8].copy_from_slice(&(1u32 | if rejected { 4 } else { 0 }).to_le_bytes());
    d[8..16].copy_from_slice(&price.to_le_bytes());
    d[16..32].copy_from_slice(&size.to_le_bytes());
    d[32..40].copy_from_slice(&c.req_id.to_le_bytes());
    d[40..48].copy_from_slice(&c.lp_account_id.to_le_bytes());
    d[48..56].copy_from_slice(&c.oracle.to_le_bytes());
    d[56..64].copy_from_slice(&(c.asset_index as u64).to_le_bytes());
    Ok(())
}
fn write_config(d: &mut [u8], c: &Config) -> ProgramResult {
    if d.len() != CONTEXT_LEN {
        return Err(ProgramError::AccountDataTooSmall);
    }
    d[STATE..STATE + 8].copy_from_slice(&MAGIC.to_le_bytes());
    d[STATE + 8] = c.paused as u8;
    d[STATE + 16..STATE + 48].copy_from_slice(c.delegate.as_ref());
    for (o, v) in [
        (48, c.base_spread_e6),
        (52, c.max_total_adjustment_e6),
        (56, c.size_coefficient_e6),
        (60, c.skew_coefficient_e6),
        (64, c.oracle_health_charge_e6),
        (68, c.hedge_charge_e6),
        (144, c.divergence_charge_e6),
        (148, c.lock_charge_e6),
        (152, c.epsilon_e6),
    ] {
        d[STATE + o..STATE + o + 4].copy_from_slice(&v.to_le_bytes())
    }
    d[STATE + 72..STATE + 80].copy_from_slice(&c.expiry_slot.to_le_bytes());
    d[STATE + 80..STATE + 96].copy_from_slice(&c.liquidity_notional_e6.to_le_bytes());
    d[STATE + 96..STATE + 112].copy_from_slice(&c.max_fill_abs.to_le_bytes());
    d[STATE + 112..STATE + 128].copy_from_slice(&c.max_inventory_abs.to_le_bytes());
    d[STATE + 128..STATE + 144].copy_from_slice(&c.inventory_base.to_le_bytes());
    Ok(())
}
fn read_config(d: &[u8]) -> Result<Config, ProgramError> {
    if d.len() != CONTEXT_LEN || read_u64(d, STATE)? != MAGIC {
        return Err(ProgramError::UninitializedAccount);
    }
    Ok(Config {
        paused: d[STATE + 8] != 0,
        delegate: Pubkey::new_from_array(d[STATE + 16..STATE + 48].try_into().unwrap()),
        base_spread_e6: read_u32(d, STATE + 48)?,
        max_total_adjustment_e6: read_u32(d, STATE + 52)?,
        size_coefficient_e6: read_u32(d, STATE + 56)?,
        skew_coefficient_e6: read_u32(d, STATE + 60)?,
        oracle_health_charge_e6: read_u32(d, STATE + 64)?,
        hedge_charge_e6: read_u32(d, STATE + 68)?,
        expiry_slot: read_u64(d, STATE + 72)?,
        liquidity_notional_e6: read_u128(d, STATE + 80)?,
        max_fill_abs: read_u128(d, STATE + 96)?,
        max_inventory_abs: read_u128(d, STATE + 112)?,
        inventory_base: read_i128(d, STATE + 128)?,
        divergence_charge_e6: read_u32(d, STATE + 144)?,
        lock_charge_e6: read_u32(d, STATE + 148)?,
        epsilon_e6: read_u32(d, STATE + 152)?,
    })
}
fn read_u16(d: &[u8], o: usize) -> Result<u16, ProgramError> {
    Ok(u16::from_le_bytes(
        d.get(o..o + 2)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .unwrap(),
    ))
}
fn read_u32(d: &[u8], o: usize) -> Result<u32, ProgramError> {
    Ok(u32::from_le_bytes(
        d.get(o..o + 4)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .unwrap(),
    ))
}
fn read_u64(d: &[u8], o: usize) -> Result<u64, ProgramError> {
    Ok(u64::from_le_bytes(
        d.get(o..o + 8)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .unwrap(),
    ))
}
fn read_u128(d: &[u8], o: usize) -> Result<u128, ProgramError> {
    Ok(u128::from_le_bytes(
        d.get(o..o + 16)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .unwrap(),
    ))
}
fn read_i128(d: &[u8], o: usize) -> Result<i128, ProgramError> {
    Ok(i128::from_le_bytes(
        d.get(o..o + 16)
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .unwrap(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn c() -> Config {
        Config {
            delegate: Pubkey::new_unique(),
            base_spread_e6: 3_000,
            max_total_adjustment_e6: 100_000,
            size_coefficient_e6: 10_000,
            skew_coefficient_e6: 80_000,
            oracle_health_charge_e6: 1_000,
            divergence_charge_e6: 2_000,
            lock_charge_e6: 0,
            hedge_charge_e6: 1_000,
            epsilon_e6: 1_000,
            expiry_slot: 100,
            liquidity_notional_e6: 1_000_000,
            max_fill_abs: 2_000_000,
            max_inventory_abs: 5_000_000,
            inventory_base: 0,
            paused: false,
        }
    }
    #[test]
    fn side_aware() {
        let b = quote(&c(), 500_000, 1_000_000, 1).unwrap();
        let s = quote(&c(), 500_000, -1_000_000, 1).unwrap();
        assert!(b.exec_price_e6 > 500_000);
        assert!(s.exec_price_e6 < 500_000);
        assert_eq!(b.next_inventory, -1_000_000)
    }
    #[test]
    fn fok_and_expiry() {
        assert!(quote(&c(), 500_000, 2_000_001, 1).is_none());
        assert!(quote(&c(), 500_000, 1, 101).is_none());
        let mut x = c();
        x.inventory_base = 5_000_000;
        assert!(quote(&x, 500_000, -1, 1).is_none())
    }
    #[test]
    fn skew_rewards_rebalance() {
        let n = quote(&c(), 500_000, -1_000_000, 1).unwrap();
        let mut x = c();
        x.inventory_base = -2_000_000;
        assert!(quote(&x, 500_000, -1_000_000, 1).unwrap().exec_price_e6 > n.exec_price_e6)
    }
    #[test]
    fn larger_orders_have_worse_prices() {
        let small_buy = quote(&c(), 500_000, 100_000, 1).unwrap();
        let large_buy = quote(&c(), 500_000, 1_000_000, 1).unwrap();
        let small_sell = quote(&c(), 500_000, -100_000, 1).unwrap();
        let large_sell = quote(&c(), 500_000, -1_000_000, 1).unwrap();
        assert!(large_buy.exec_price_e6 > small_buy.exec_price_e6);
        assert!(large_sell.exec_price_e6 < small_sell.exec_price_e6);
    }
    #[test]
    fn live_bounds_and_overflow_fail_closed() {
        assert_eq!(
            quote(&c(), 1_000, -2_000_000, 1).unwrap().exec_price_e6,
            1_000
        );
        assert_eq!(
            quote(&c(), 999_000, 2_000_000, 1).unwrap().exec_price_e6,
            999_000
        );
        assert!(quote(&c(), 999, 1, 1).is_none());
        let mut x = c();
        x.max_inventory_abs = u128::MAX;
        x.inventory_base = i128::MIN;
        assert!(quote(&x, 500_000, 1, 1).is_none());
    }
}
