#![cfg_attr(target_os = "solana", no_std)]

extern crate alloc;

use alloc::{format, vec, vec::Vec};
use percolator_prog::{ix::Instruction as PercolatorInstruction, processor::ASSET_ACTION_ACTIVATE};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction, system_program,
    sysvar::Sysvar,
};

const CONFIG_MAGIC: u64 = 0x4d4f_5849_4543_4647;
const RECORD_MAGIC: u64 = 0x4d4f_5849_454d_4b54;
pub const CONFIG_LEN: usize = 160;
pub const RECORD_LEN: usize = 288;
pub const CONFIG_SEED: &[u8] = b"config";
pub const MARKET_SEED: &[u8] = b"imported";
const MAX_FUTURE_SKEW_SECS: i64 = 5;

#[repr(u32)]
enum MoxieError {
    InvalidInstruction = 1,
    InvalidAccount = 2,
    Unauthorized = 3,
    AlreadyInitialized = 4,
    Paused = 5,
    StaleObservation = 6,
    IdentityMismatch = 7,
    InvalidProbability = 8,
    SequenceMismatch = 9,
}

impl From<MoxieError> for ProgramError {
    fn from(value: MoxieError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Config {
    pub paused: bool,
    pub admin: Pubkey,
    pub reporter: Pubkey,
    pub percolator_program: Pubkey,
    pub market_group: Pubkey,
    pub max_observation_age_secs: u64,
}

impl Config {
    fn read(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() != CONFIG_LEN || read_u64(data, 0)? != CONFIG_MAGIC || data[8] != 1 {
            return Err(MoxieError::InvalidAccount.into());
        }
        Ok(Self {
            paused: data[9] != 0,
            admin: read_pubkey(data, 16)?,
            reporter: read_pubkey(data, 48)?,
            percolator_program: read_pubkey(data, 80)?,
            market_group: read_pubkey(data, 112)?,
            max_observation_age_secs: read_u64(data, 144)?,
        })
    }

    fn write(&self, data: &mut [u8]) -> ProgramResult {
        if data.len() != CONFIG_LEN {
            return Err(MoxieError::InvalidAccount.into());
        }
        data.fill(0);
        data[0..8].copy_from_slice(&CONFIG_MAGIC.to_le_bytes());
        data[8] = 1;
        data[9] = u8::from(self.paused);
        data[16..48].copy_from_slice(self.admin.as_ref());
        data[48..80].copy_from_slice(self.reporter.as_ref());
        data[80..112].copy_from_slice(self.percolator_program.as_ref());
        data[112..144].copy_from_slice(self.market_group.as_ref());
        data[144..152].copy_from_slice(&self.max_observation_age_secs.to_le_bytes());
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ImportedPerpMarket {
    pub external_market_id_hash: [u8; 32],
    pub external_yes_id_hash: [u8; 32],
    pub external_no_id_hash: [u8; 32],
    pub title_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub external_close_time: i64,
    pub percolator_market_group: Pubkey,
    pub percolator_asset_index: u16,
    pub percolator_market_id: u64,
    pub reporter: Pubkey,
    pub last_source_timestamp: i64,
    pub last_observation_slot: u64,
    pub last_observation_sequence: u64,
    pub last_mark_e6: u64,
    pub status: u8,
}

impl ImportedPerpMarket {
    pub fn read(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() != RECORD_LEN || read_u64(data, 0)? != RECORD_MAGIC || data[8] != 1 {
            return Err(MoxieError::InvalidAccount.into());
        }
        Ok(Self {
            status: data[9],
            percolator_asset_index: read_u16(data, 10)?,
            external_market_id_hash: read_array_32(data, 16)?,
            external_yes_id_hash: read_array_32(data, 48)?,
            external_no_id_hash: read_array_32(data, 80)?,
            title_hash: read_array_32(data, 112)?,
            rules_hash: read_array_32(data, 144)?,
            external_close_time: read_i64(data, 176)?,
            percolator_market_id: read_u64(data, 184)?,
            percolator_market_group: read_pubkey(data, 192)?,
            reporter: read_pubkey(data, 224)?,
            last_source_timestamp: read_i64(data, 256)?,
            last_observation_slot: read_u64(data, 264)?,
            last_observation_sequence: read_u64(data, 272)?,
            last_mark_e6: read_u64(data, 280)?,
        })
    }

    fn write(&self, data: &mut [u8]) -> ProgramResult {
        if data.len() != RECORD_LEN {
            return Err(MoxieError::InvalidAccount.into());
        }
        data.fill(0);
        data[0..8].copy_from_slice(&RECORD_MAGIC.to_le_bytes());
        data[8] = 1;
        data[9] = self.status;
        data[10..12].copy_from_slice(&self.percolator_asset_index.to_le_bytes());
        data[16..48].copy_from_slice(&self.external_market_id_hash);
        data[48..80].copy_from_slice(&self.external_yes_id_hash);
        data[80..112].copy_from_slice(&self.external_no_id_hash);
        data[112..144].copy_from_slice(&self.title_hash);
        data[144..176].copy_from_slice(&self.rules_hash);
        data[176..184].copy_from_slice(&self.external_close_time.to_le_bytes());
        data[184..192].copy_from_slice(&self.percolator_market_id.to_le_bytes());
        data[192..224].copy_from_slice(self.percolator_market_group.as_ref());
        data[224..256].copy_from_slice(self.reporter.as_ref());
        data[256..264].copy_from_slice(&self.last_source_timestamp.to_le_bytes());
        data[264..272].copy_from_slice(&self.last_observation_slot.to_le_bytes());
        data[272..280].copy_from_slice(&self.last_observation_sequence.to_le_bytes());
        data[280..288].copy_from_slice(&self.last_mark_e6.to_le_bytes());
        Ok(())
    }
}

#[derive(Clone, Copy)]
struct ActivationArgs {
    external_market_id_hash: [u8; 32],
    external_yes_id_hash: [u8; 32],
    external_no_id_hash: [u8; 32],
    title_hash: [u8; 32],
    rules_hash: [u8; 32],
    external_close_time: i64,
    asset_index: u16,
    market_id: u64,
    initial_mark_e6: u64,
    now_slot: u64,
}

#[derive(Clone, Copy)]
struct ObservationArgs {
    external_market_id_hash: [u8; 32],
    rules_hash: [u8; 32],
    asset_index: u16,
    market_id: u64,
    mark_e6: u64,
    source_timestamp: i64,
    sequence: u64,
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (&tag, data) = instruction_data
        .split_first()
        .ok_or(MoxieError::InvalidInstruction)?;
    match tag {
        0 => initialize_config(program_id, accounts, data),
        1 => activate_imported_perp(program_id, accounts, parse_activation(data)?),
        2 => submit_observation(program_id, accounts, parse_observation(data)?),
        3 => set_paused(program_id, accounts, data),
        _ => Err(MoxieError::InvalidInstruction.into()),
    }
}

fn initialize_config(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 40 {
        return Err(MoxieError::InvalidInstruction.into());
    }
    let mut iter = accounts.iter();
    let admin = next_account_info(&mut iter)?;
    let config = next_account_info(&mut iter)?;
    let percolator_program = next_account_info(&mut iter)?;
    let market = next_account_info(&mut iter)?;
    let system = next_account_info(&mut iter)?;
    require_signer(admin)?;
    if !admin.is_writable
        || !config.is_writable
        || !percolator_program.executable
        || market.owner != percolator_program.key
        || system.key != &system_program::id()
    {
        return Err(MoxieError::InvalidAccount.into());
    }
    let (expected, bump) =
        Pubkey::find_program_address(&[CONFIG_SEED, market.key.as_ref()], program_id);
    if config.key != &expected || config.data_len() != 0 {
        return Err(MoxieError::AlreadyInitialized.into());
    }
    let reporter = read_pubkey(data, 0)?;
    let max_age = read_u64(data, 32)?;
    if reporter == Pubkey::default() || max_age == 0 || max_age > 3_600 {
        return Err(MoxieError::InvalidInstruction.into());
    }
    invoke_signed(
        &system_instruction::create_account(
            admin.key,
            config.key,
            Rent::get()?.minimum_balance(CONFIG_LEN),
            CONFIG_LEN as u64,
            program_id,
        ),
        &[admin.clone(), config.clone(), system.clone()],
        &[&[CONFIG_SEED, market.key.as_ref(), &[bump]]],
    )?;
    Config {
        paused: false,
        admin: *admin.key,
        reporter,
        percolator_program: *percolator_program.key,
        market_group: *market.key,
        max_observation_age_secs: max_age,
    }
    .write(&mut config.try_borrow_mut_data()?)
}

fn activate_imported_perp(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: ActivationArgs,
) -> ProgramResult {
    let mut iter = accounts.iter();
    let admin = next_account_info(&mut iter)?;
    let reporter = next_account_info(&mut iter)?;
    let config_ai = next_account_info(&mut iter)?;
    let record_ai = next_account_info(&mut iter)?;
    let market = next_account_info(&mut iter)?;
    let percolator_program = next_account_info(&mut iter)?;
    let system = next_account_info(&mut iter)?;
    require_signer(admin)?;
    require_signer(reporter)?;
    let config = load_config(program_id, config_ai)?;
    if config.paused {
        return Err(MoxieError::Paused.into());
    }
    if admin.key != &config.admin || reporter.key != &config.reporter {
        return Err(MoxieError::Unauthorized.into());
    }
    require_percolator_accounts(&config, market, percolator_program)?;
    if !admin.is_writable || !record_ai.is_writable || system.key != &system_program::id() {
        return Err(MoxieError::InvalidAccount.into());
    }
    validate_probability(args.initial_mark_e6)?;
    let clock = Clock::get()?;
    if args.external_close_time <= clock.unix_timestamp
        || args.now_slot > clock.slot
        || args.external_market_id_hash == [0; 32]
        || args.rules_hash == [0; 32]
    {
        return Err(MoxieError::InvalidInstruction.into());
    }
    let (expected, bump) = Pubkey::find_program_address(
        &[
            MARKET_SEED,
            config_ai.key.as_ref(),
            &args.external_market_id_hash,
        ],
        program_id,
    );
    if record_ai.key != &expected || record_ai.data_len() != 0 {
        return Err(MoxieError::AlreadyInitialized.into());
    }
    invoke_signed(
        &system_instruction::create_account(
            admin.key,
            record_ai.key,
            Rent::get()?.minimum_balance(RECORD_LEN),
            RECORD_LEN as u64,
            program_id,
        ),
        &[admin.clone(), record_ai.clone(), system.clone()],
        &[&[
            MARKET_SEED,
            config_ai.key.as_ref(),
            &args.external_market_id_hash,
            &[bump],
        ]],
    )?;
    cpi_percolator(
        percolator_program,
        &[admin.clone(), market.clone()],
        PercolatorInstruction::UpdateAssetLifecycle {
            action: ASSET_ACTION_ACTIVATE,
            asset_index: args.asset_index,
            market_id: args.market_id,
            authority_epoch: 0,
            now_slot: args.now_slot,
            initial_price: args.initial_mark_e6,
            max_init_fee: 0,
            insurance_authority: admin.key.to_bytes(),
            insurance_operator: admin.key.to_bytes(),
            backing_bucket_authority: admin.key.to_bytes(),
            oracle_authority: reporter.key.to_bytes(),
        },
        vec![
            AccountMeta::new_readonly(*admin.key, true),
            AccountMeta::new(*market.key, false),
        ],
    )?;
    cpi_percolator(
        percolator_program,
        &[reporter.clone(), market.clone()],
        PercolatorInstruction::ConfigureAuthMark {
            asset_index: args.asset_index,
            market_id: args.market_id,
            now_slot: args.now_slot,
            initial_mark_e6: args.initial_mark_e6,
            observation_sequence: 1,
            authority_epoch: 0,
        },
        vec![
            AccountMeta::new_readonly(*reporter.key, true),
            AccountMeta::new(*market.key, false),
        ],
    )?;
    ImportedPerpMarket {
        external_market_id_hash: args.external_market_id_hash,
        external_yes_id_hash: args.external_yes_id_hash,
        external_no_id_hash: args.external_no_id_hash,
        title_hash: args.title_hash,
        rules_hash: args.rules_hash,
        external_close_time: args.external_close_time,
        percolator_market_group: *market.key,
        percolator_asset_index: args.asset_index,
        percolator_market_id: args.market_id,
        reporter: *reporter.key,
        // Permit the first authenticated observation in the activation second.
        last_source_timestamp: clock.unix_timestamp.saturating_sub(1),
        last_observation_slot: clock.slot,
        last_observation_sequence: 1,
        last_mark_e6: args.initial_mark_e6,
        status: 1,
    }
    .write(&mut record_ai.try_borrow_mut_data()?)
}

fn submit_observation(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: ObservationArgs,
) -> ProgramResult {
    let mut iter = accounts.iter();
    let reporter = next_account_info(&mut iter)?;
    let config_ai = next_account_info(&mut iter)?;
    let record_ai = next_account_info(&mut iter)?;
    let market = next_account_info(&mut iter)?;
    let percolator_program = next_account_info(&mut iter)?;
    require_signer(reporter)?;
    let config = load_config(program_id, config_ai)?;
    if config.paused {
        return Err(MoxieError::Paused.into());
    }
    if reporter.key != &config.reporter || record_ai.owner != program_id || !record_ai.is_writable {
        return Err(MoxieError::Unauthorized.into());
    }
    require_percolator_accounts(&config, market, percolator_program)?;
    let mut record = ImportedPerpMarket::read(&record_ai.try_borrow_data()?)?;
    if record.status != 1
        || record.external_market_id_hash != args.external_market_id_hash
        || record.rules_hash != args.rules_hash
        || record.percolator_market_group != *market.key
        || record.percolator_asset_index != args.asset_index
        || record.percolator_market_id != args.market_id
        || record.reporter != *reporter.key
    {
        return Err(MoxieError::IdentityMismatch.into());
    }
    validate_probability(args.mark_e6)?;
    let clock = Clock::get()?;
    if args.source_timestamp <= record.last_source_timestamp
        || args.source_timestamp > clock.unix_timestamp.saturating_add(MAX_FUTURE_SKEW_SECS)
        || clock.unix_timestamp.saturating_sub(args.source_timestamp)
            > config.max_observation_age_secs as i64
    {
        return Err(MoxieError::StaleObservation.into());
    }
    if args.sequence != record.last_observation_sequence.saturating_add(1) {
        return Err(MoxieError::SequenceMismatch.into());
    }
    record.last_source_timestamp = args.source_timestamp;
    record.last_observation_slot = clock.slot;
    record.last_observation_sequence = args.sequence;
    record.last_mark_e6 = args.mark_e6;
    record.write(&mut record_ai.try_borrow_mut_data()?)?;
    cpi_percolator(
        percolator_program,
        &[reporter.clone(), market.clone()],
        PercolatorInstruction::PushAuthMark {
            asset_index: args.asset_index,
            market_id: args.market_id,
            now_slot: clock.slot,
            mark_e6: args.mark_e6,
            observation_sequence: args.sequence,
            authority_epoch: 0,
        },
        vec![
            AccountMeta::new_readonly(*reporter.key, true),
            AccountMeta::new(*market.key, false),
        ],
    )
}

fn set_paused(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() != 1 || data[0] > 1 {
        return Err(MoxieError::InvalidInstruction.into());
    }
    let mut iter = accounts.iter();
    let admin = next_account_info(&mut iter)?;
    let config_ai = next_account_info(&mut iter)?;
    require_signer(admin)?;
    let mut config = load_config(program_id, config_ai)?;
    if admin.key != &config.admin || !config_ai.is_writable {
        return Err(MoxieError::Unauthorized.into());
    }
    config.paused = data[0] == 1;
    config.write(&mut config_ai.try_borrow_mut_data()?)
}

fn load_config(program_id: &Pubkey, account: &AccountInfo) -> Result<Config, ProgramError> {
    if account.owner != program_id {
        return Err(MoxieError::InvalidAccount.into());
    }
    Config::read(&account.try_borrow_data()?)
}

fn require_percolator_accounts(
    config: &Config,
    market: &AccountInfo,
    program: &AccountInfo,
) -> ProgramResult {
    if program.key != &config.percolator_program
        || !program.executable
        || market.key != &config.market_group
        || market.owner != program.key
        || !market.is_writable
    {
        return Err(MoxieError::InvalidAccount.into());
    }
    Ok(())
}

fn cpi_percolator<'a>(
    program: &AccountInfo<'a>,
    accounts: &[AccountInfo<'a>],
    instruction: PercolatorInstruction,
    metas: Vec<AccountMeta>,
) -> ProgramResult {
    let ix = Instruction {
        program_id: *program.key,
        accounts: metas,
        data: instruction.encode(),
    };
    let mut infos = accounts.to_vec();
    infos.push(program.clone());
    invoke(&ix, &infos)
}

fn require_signer(account: &AccountInfo) -> ProgramResult {
    if !account.is_signer {
        msg!("required signer missing");
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

fn validate_probability(mark: u64) -> ProgramResult {
    if !(1..=999_999).contains(&mark) {
        return Err(MoxieError::InvalidProbability.into());
    }
    Ok(())
}

fn parse_activation(data: &[u8]) -> Result<ActivationArgs, ProgramError> {
    if data.len() != 194 {
        return Err(MoxieError::InvalidInstruction.into());
    }
    Ok(ActivationArgs {
        external_market_id_hash: read_array_32(data, 0)?,
        external_yes_id_hash: read_array_32(data, 32)?,
        external_no_id_hash: read_array_32(data, 64)?,
        title_hash: read_array_32(data, 96)?,
        rules_hash: read_array_32(data, 128)?,
        external_close_time: read_i64(data, 160)?,
        asset_index: read_u16(data, 168)?,
        market_id: read_u64(data, 170)?,
        initial_mark_e6: read_u64(data, 178)?,
        now_slot: read_u64(data, 186)?,
    })
}

fn parse_observation(data: &[u8]) -> Result<ObservationArgs, ProgramError> {
    if data.len() != 98 {
        return Err(MoxieError::InvalidInstruction.into());
    }
    Ok(ObservationArgs {
        external_market_id_hash: read_array_32(data, 0)?,
        rules_hash: read_array_32(data, 32)?,
        asset_index: read_u16(data, 64)?,
        market_id: read_u64(data, 66)?,
        mark_e6: read_u64(data, 74)?,
        source_timestamp: read_i64(data, 82)?,
        sequence: read_u64(data, 90)?,
    })
}

fn read_array_32(data: &[u8], offset: usize) -> Result<[u8; 32], ProgramError> {
    data.get(offset..offset + 32)
        .ok_or_else(|| ProgramError::from(MoxieError::InvalidInstruction))?
        .try_into()
        .map_err(|_| MoxieError::InvalidInstruction.into())
}
fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey, ProgramError> {
    Ok(Pubkey::new_from_array(read_array_32(data, offset)?))
}
fn read_u16(data: &[u8], offset: usize) -> Result<u16, ProgramError> {
    Ok(u16::from_le_bytes(
        data.get(offset..offset + 2)
            .ok_or(MoxieError::InvalidInstruction)?
            .try_into()
            .unwrap(),
    ))
}
fn read_u64(data: &[u8], offset: usize) -> Result<u64, ProgramError> {
    Ok(u64::from_le_bytes(
        data.get(offset..offset + 8)
            .ok_or(MoxieError::InvalidInstruction)?
            .try_into()
            .unwrap(),
    ))
}
fn read_i64(data: &[u8], offset: usize) -> Result<i64, ProgramError> {
    Ok(i64::from_le_bytes(
        data.get(offset..offset + 8)
            .ok_or(MoxieError::InvalidInstruction)?
            .try_into()
            .unwrap(),
    ))
}

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn state_layout_roundtrips() {
        let key = Pubkey::new_unique();
        let record = ImportedPerpMarket {
            external_market_id_hash: [1; 32],
            external_yes_id_hash: [2; 32],
            external_no_id_hash: [3; 32],
            title_hash: [4; 32],
            rules_hash: [5; 32],
            external_close_time: 123,
            percolator_market_group: key,
            percolator_asset_index: 7,
            percolator_market_id: 42,
            reporter: key,
            last_source_timestamp: 100,
            last_observation_slot: 9,
            last_observation_sequence: 3,
            last_mark_e6: 650_000,
            status: 1,
        };
        let mut bytes = [0u8; RECORD_LEN];
        record.write(&mut bytes).unwrap();
        assert_eq!(ImportedPerpMarket::read(&bytes).unwrap(), record);
    }
    #[test]
    fn probability_boundaries_fail_closed() {
        assert!(validate_probability(0).is_err());
        assert!(validate_probability(1).is_ok());
        assert!(validate_probability(999_999).is_ok());
        assert!(validate_probability(1_000_000).is_err());
    }
}
