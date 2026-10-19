#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, vec, Address,
    Env, IntoVal, Map, String, Symbol, Vec,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TimeLockError {
    NotInitialized = 1,
    Unauthorized = 2,
    NotLocked = 3,
    AlreadyLocked = 4,
    LockNotExpired = 5,
    InvalidUnlockTime = 6,
    VintageValidationFailed = 7,
    EmptyBatch = 8,
    /// Contract initialization has already completed.
    AlreadyInitialized = 9,
    /// Invalid TTL configuration (must be positive).
    InvalidTtlConfig = 10,
    /// TTL not configured.
    TtlNotConfigured = 11,
    /// The underlying token-ID-aware transfer call failed.
    TokenTransferFailed = 12,
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LockRecord {
    pub token_id: u32,
    pub owner: Address,
    pub unlock_timestamp: u64,
    pub deposited_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TtlConfig {
    /// Time-to-live for lock records after unlock expiration (in seconds)
    pub ttl_seconds: u64,
    /// Timestamp when this TTL configuration was set
    pub configured_at: u64,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
enum DataKey {
    Admin,
    CarbonAssetContract,
    ValidateVintage,
    VintageCheckContract,
    LockRecords,
    TtlConfig,
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

#[contractevent]
pub struct CreditLocked {
    pub token_id: u32,
    pub owner: Address,
    pub unlock_timestamp: u64,
    pub deposited_at: u64,
}

#[contractevent]
pub struct CreditReleased {
    pub token_id: u32,
    pub owner: Address,
    pub unlock_timestamp: u64,
    pub released_at: u64,
}

#[contractevent]
pub struct ForceRelease {
    pub token_id: u32,
    pub owner: Address,
    pub admin: Address,
    pub bypassed_unlock_timestamp: u64,
    pub released_at: u64,
}

#[contractevent]
pub struct RecordPruned {
    pub token_id: u32,
    pub owner: Address,
    pub unlock_timestamp: u64,
    pub deposited_at: u64,
    pub pruned_at: u64,
    pub reason: String,
}

#[contractevent]
pub struct TtlConfigured {
    pub ttl_seconds: u64,
    pub configured_at: u64,
    pub configured_by: Address,
}

// ---------------------------------------------------------------------------
// Event emitter helpers
// ---------------------------------------------------------------------------

fn emit_credit_locked(env: &Env, token_id: u32, owner: Address, unlock_timestamp: u64) {
    CreditLocked {
        token_id,
        owner,
        unlock_timestamp,
        deposited_at: env.ledger().timestamp(),
    }
    .publish(env);
}

fn emit_credit_released(env: &Env, token_id: u32, owner: Address, unlock_timestamp: u64) {
    CreditReleased {
        token_id,
        owner,
        unlock_timestamp,
        released_at: env.ledger().timestamp(),
    }
    .publish(env);
}

fn emit_force_release(
    env: &Env,
    token_id: u32,
    owner: Address,
    admin: Address,
    bypassed_unlock_timestamp: u64,
) {
    ForceRelease {
        token_id,
        owner,
        admin,
        bypassed_unlock_timestamp,
        released_at: env.ledger().timestamp(),
    }
    .publish(env);
}

fn emit_record_pruned(
    env: &Env,
    token_id: u32,
    owner: Address,
    unlock_timestamp: u64,
    deposited_at: u64,
    reason: String,
) {
    RecordPruned {
        token_id,
        owner,
        unlock_timestamp,
        deposited_at,
        pruned_at: env.ledger().timestamp(),
        reason,
    }
    .publish(env);
}

fn emit_ttl_configured(env: &Env, ttl_seconds: u64, configured_by: Address) {
    TtlConfigured {
        ttl_seconds,
        configured_at: env.ledger().timestamp(),
        configured_by,
    }
    .publish(env);
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct TimeLock;

#[contractimpl]
impl TimeLock {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Initialise the contract. Must be called once before any other function.
    ///
    /// # Arguments
    /// * `admin`                 – Governance / admin address.
    /// * `carbon_asset_contract` – Address of the SEP-41 CarbonAsset contract.
    /// * `validate_vintage`      – Whether to validate that `unlock_timestamp`
    ///                             aligns with the token's vintage year.
    /// * `vintage_check_contract`– Optional override contract for the metadata
    ///                             check (defaults to `carbon_asset_contract`).
    /// * `default_ttl_seconds`   – Default TTL for lock records after unlock expiration
    ///                             (in seconds). Set to 0 to disable automatic pruning.
    pub fn initialize(
        env: Env,
        admin: Address,
        carbon_asset_contract: Address,
        validate_vintage: bool,
        vintage_check_contract: Option<Address>,
        default_ttl_seconds: u64,
    ) -> Result<(), TimeLockError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(TimeLockError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CarbonAssetContract, &carbon_asset_contract);
        env.storage()
            .instance()
            .set(&DataKey::ValidateVintage, &validate_vintage);
        env.storage()
            .instance()
            .set(&DataKey::VintageCheckContract, &vintage_check_contract);

        let records: Map<u32, LockRecord> = Map::new(&env);
        env.storage()
            .persistent()
            .set(&DataKey::LockRecords, &records);

        // Set default TTL configuration
        let ttl_config = TtlConfig {
            ttl_seconds: default_ttl_seconds,
            configured_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::TtlConfig, &ttl_config);

        Ok(())
    }

    pub fn version(_env: Env) -> u32 {
        1
    }

    /// Lock a CarbonAsset token in this contract's custody.
    ///
    /// The caller must have previously approved this contract as an operator on
    /// the CarbonAsset contract (or must be the owner calling `transfer_from`).
    ///
    /// # Arguments
    /// * `caller`            – Address locking the credit (pays fees, must auth).
    /// * `token_id`          – Identifier of the carbon credit token.
    /// * `unlock_timestamp`  – Unix timestamp after which the credit is releasable.
    pub fn lock_credit(
        env: Env,
        caller: Address,
        token_id: u32,
        unlock_timestamp: u64,
    ) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;
        caller.require_auth();

        let now = env.ledger().timestamp();

        if unlock_timestamp <= now {
            return Err(TimeLockError::InvalidUnlockTime);
        }

        let mut records = Self::load_records(&env);

        if records.contains_key(token_id) {
            return Err(TimeLockError::AlreadyLocked);
        }

        let validate: bool = env
            .storage()
            .instance()
            .get(&DataKey::ValidateVintage)
            .unwrap_or(false);

        if validate {
            Self::validate_vintage_timestamp(&env, token_id, unlock_timestamp)?;
        }

        let ca_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(TimeLockError::NotInitialized)?;

        env.invoke_contract::<()>(
            &ca_contract,
            &Symbol::new(&env, "transfer_token_from"),
            vec![
                &env,
                env.current_contract_address().into_val(&env),
                caller.into_val(&env),
                env.current_contract_address().into_val(&env),
                token_id.into_val(&env),
            ],
        );

        let record = LockRecord {
            token_id,
            owner: caller.clone(),
            unlock_timestamp,
            deposited_at: now,
        };
        records.set(token_id, record);
        Self::save_records(&env, &records);

        emit_credit_locked(&env, token_id, caller, unlock_timestamp);

        Ok(())
    }

    /// Release a single locked credit back to its owner if the lock has expired.
    ///
    /// This is intentionally permissionless so that relayers / keepers can call
    /// it on behalf of inactive owners.
    pub fn release_if_eligible(env: Env, token_id: u32) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;

        let mut records = Self::load_records(&env);

        let record = records.get(token_id).ok_or(TimeLockError::NotLocked)?;

        let now = env.ledger().timestamp();
        if now < record.unlock_timestamp {
            return Err(TimeLockError::LockNotExpired);
        }

        let ca_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(TimeLockError::NotInitialized)?;

        env.invoke_contract::<()>(
            &ca_contract,
            &Symbol::new(&env, "transfer_token"),
            vec![
                &env,
                env.current_contract_address().into_val(&env),
                record.owner.into_val(&env),
                token_id.into_val(&env),
            ],
        );

        records.remove(token_id);
        Self::save_records(&env, &records);

        emit_credit_released(&env, token_id, record.owner, record.unlock_timestamp);

        Ok(())
    }

    /// Trigger eligibility checks for multiple token IDs in one transaction.
    ///
    /// Skips tokens that are not yet eligible or not locked – does not revert.
    /// Returns the list of token IDs that were successfully released.
    pub fn batch_release(env: Env, token_ids: Vec<u32>) -> Result<Vec<u32>, TimeLockError> {
        Self::require_initialized(&env)?;

        if token_ids.is_empty() {
            return Err(TimeLockError::EmptyBatch);
        }

        let mut records = Self::load_records(&env);
        let now = env.ledger().timestamp();

        let ca_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(TimeLockError::NotInitialized)?;

        let mut released: Vec<u32> = vec![&env];

        for token_id in token_ids.iter() {
            if let Some(record) = records.get(token_id) {
                if now >= record.unlock_timestamp {
                    let transfer_ok = env
                        .try_invoke_contract::<(), TimeLockError>(
                            &ca_contract,
                            &Symbol::new(&env, "transfer_token"),
                            vec![
                                &env,
                                env.current_contract_address().into_val(&env),
                                record.owner.into_val(&env),
                                token_id.into_val(&env),
                            ],
                        )
                        .map_or(false, |inner| inner.is_ok());

                    if !transfer_ok {
                        continue;
                    }

                    emit_credit_released(
                        &env,
                        token_id,
                        record.owner.clone(),
                        record.unlock_timestamp,
                    );
                    records.remove(token_id);
                    released.push_back(token_id);
                }
            }
        }

        Self::save_records(&env, &records);
        Ok(released)
    }

    /// Admin-only override to release a token before its unlock time.
    pub fn force_release(env: Env, token_id: u32) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TimeLockError::NotInitialized)?;
        admin.require_auth();

        let mut records = Self::load_records(&env);
        let record = records.get(token_id).ok_or(TimeLockError::NotLocked)?;

        let ca_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(TimeLockError::NotInitialized)?;

        env.invoke_contract::<()>(
            &ca_contract,
            &Symbol::new(&env, "transfer_token"),
            vec![
                &env,
                env.current_contract_address().into_val(&env),
                record.owner.into_val(&env),
                token_id.into_val(&env),
            ],
        );

        records.remove(token_id);
        Self::save_records(&env, &records);

        emit_force_release(&env, token_id, record.owner, admin, record.unlock_timestamp);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    pub fn get_lock_status(env: Env, token_id: u32) -> Option<LockRecord> {
        let records = Self::load_records(&env);
        records.get(token_id)
    }

    pub fn get_tokens_locked_until(env: Env, after_timestamp: u64) -> Vec<u32> {
        let records = Self::load_records(&env);
        let mut result: Vec<u32> = vec![&env];

        for (token_id, record) in records.iter() {
            if record.unlock_timestamp > after_timestamp {
                result.push_back(token_id);
            }
        }

        result
    }

    pub fn get_all_locked(env: Env) -> Vec<LockRecord> {
        let records = Self::load_records(&env);
        let mut result: Vec<LockRecord> = vec![&env];
        for (_token_id, record) in records.iter() {
            result.push_back(record);
        }
        result
    }

    pub fn get_record_count(env: Env) -> u32 {
        let records = Self::load_records(&env);
        records.len()
    }

    pub fn get_ttl_config(env: Env) -> Option<TtlConfig> {
        env.storage().instance().get(&DataKey::TtlConfig)
    }

    // -----------------------------------------------------------------------
    // TTL and Pruning functions
    // -----------------------------------------------------------------------

    /// Prune a single lock record that has exceeded its TTL.
    ///
    /// This function removes lock records that have expired beyond their TTL window.
    /// A record is eligible for pruning if:
    /// - The current time is greater than (unlock_timestamp + ttl_seconds)
    /// - The TTL is configured (ttl_seconds > 0)
    ///
    /// This is permissionless to allow keepers/relayers to maintain storage.
    pub fn prune_expired(env: Env, token_id: u32) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;

        let ttl_config: TtlConfig = env
            .storage()
            .instance()
            .get(&DataKey::TtlConfig)
            .ok_or(TimeLockError::TtlNotConfigured)?;

        if ttl_config.ttl_seconds == 0 {
            return Err(TimeLockError::TtlNotConfigured);
        }

        let mut records = Self::load_records(&env);
        let record = records.get(token_id).ok_or(TimeLockError::NotLocked)?;

        let now = env.ledger().timestamp();
        let expiry_threshold = record
            .unlock_timestamp
            .saturating_add(ttl_config.ttl_seconds);

        if now < expiry_threshold {
            return Err(TimeLockError::LockNotExpired);
        }

        // Record has exceeded TTL, prune it
        records.remove(token_id);
        Self::save_records(&env, &records);

        emit_record_pruned(
            &env,
            token_id,
            record.owner,
            record.unlock_timestamp,
            record.deposited_at,
            String::from_str(&env, "ttl_expired"),
        );

        Ok(())
    }

    /// Batch prune multiple lock records that have exceeded their TTL.
    ///
    /// This gas-efficient function processes multiple records in a single transaction.
    /// Skips records that are not yet eligible for pruning or not locked.
    /// Returns the list of token IDs that were successfully pruned.
    ///
    /// # Arguments
    /// * `token_ids` - List of token IDs to check for pruning eligibility
    /// * `max_prune` - Maximum number of records to prune in this transaction (gas limit)
    pub fn batch_prune_expired(
        env: Env,
        token_ids: Vec<u32>,
        max_prune: u32,
    ) -> Result<Vec<u32>, TimeLockError> {
        Self::require_initialized(&env)?;

        if token_ids.is_empty() {
            return Err(TimeLockError::EmptyBatch);
        }

        let ttl_config: TtlConfig = env
            .storage()
            .instance()
            .get(&DataKey::TtlConfig)
            .ok_or(TimeLockError::TtlNotConfigured)?;

        if ttl_config.ttl_seconds == 0 {
            return Err(TimeLockError::TtlNotConfigured);
        }

        let mut records = Self::load_records(&env);
        let now = env.ledger().timestamp();
        let mut pruned: Vec<u32> = vec![&env];
        let mut pruned_count = 0u32;

        for token_id in token_ids.iter() {
            if pruned_count >= max_prune {
                break;
            }

            if let Some(record) = records.get(token_id) {
                let expiry_threshold = record
                    .unlock_timestamp
                    .saturating_add(ttl_config.ttl_seconds);

                if now >= expiry_threshold {
                    records.remove(token_id);
                    emit_record_pruned(
                        &env,
                        token_id,
                        record.owner.clone(),
                        record.unlock_timestamp,
                        record.deposited_at,
                        String::from_str(&env, "ttl_expired"),
                    );
                    pruned.push_back(token_id);
                    pruned_count += 1;
                }
            }
        }

        Self::save_records(&env, &records);
        Ok(pruned)
    }

    // -----------------------------------------------------------------------
    // Admin helpers
    // -----------------------------------------------------------------------

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;
        let current_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TimeLockError::NotInitialized)?;
        current_admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    pub fn set_validate_vintage(
        env: Env,
        validate: bool,
        vintage_check_contract: Option<Address>,
    ) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TimeLockError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::ValidateVintage, &validate);
        env.storage()
            .instance()
            .set(&DataKey::VintageCheckContract, &vintage_check_contract);
        Ok(())
    }

    pub fn set_ttl(env: Env, ttl_seconds: u64) -> Result<(), TimeLockError> {
        Self::require_initialized(&env)?;
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(TimeLockError::NotInitialized)?;
        admin.require_auth();

        let ttl_config = TtlConfig {
            ttl_seconds,
            configured_at: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::TtlConfig, &ttl_config);

        emit_ttl_configured(&env, ttl_seconds, admin);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    fn require_initialized(env: &Env) -> Result<(), TimeLockError> {
        if env.storage().instance().has(&DataKey::Admin) {
            Ok(())
        } else {
            Err(TimeLockError::NotInitialized)
        }
    }

    fn load_records(env: &Env) -> Map<u32, LockRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::LockRecords)
            .unwrap_or_else(|| Map::new(env))
    }

    fn save_records(env: &Env, records: &Map<u32, LockRecord>) {
        env.storage()
            .persistent()
            .set(&DataKey::LockRecords, records);
    }

    /// Validate that `unlock_timestamp` is consistent with the credit's vintage
    /// year stored in the CarbonAsset metadata contract.
    ///
    /// The vintage year defines the calendar year in which sequestration occurred.
    /// Under Gregorian civil calendar semantics in UTC with reference to the Unix epoch
    /// (1970-01-01 00:00:00 UTC), the valid unlock eligibility window is defined as:
    ///   Jan 1 of (vintage_year + 1) 00:00:00 UTC ≤ unlock_timestamp ≤ Dec 31 of (vintage_year + 6) 23:59:59 UTC
    ///
    /// Both bounds are inclusive and calculated using exact leap-year-aware civil calendar
    /// arithmetic (accounting for 4-year leap years, 100-year non-leap century rules, and
    /// 400-year leap century rules).
    ///
    /// This is a conservative window that prevents premature sale while
    /// avoiding perpetual lock-ups. Projects can configure tighter windows via
    /// governance.
    fn validate_vintage_timestamp(
        env: &Env,
        token_id: u32,
        unlock_timestamp: u64,
    ) -> Result<(), TimeLockError> {
        let check_contract: Address = env
            .storage()
            .instance()
            .get::<_, Option<Address>>(&DataKey::VintageCheckContract)
            .flatten()
            .or_else(|| env.storage().instance().get(&DataKey::CarbonAssetContract))
            .ok_or(TimeLockError::NotInitialized)?;

        let vintage_year: u32 = env.invoke_contract(
            &check_contract,
            &symbol_short!("vintage"),
            soroban_sdk::vec![env, soroban_sdk::Val::from(token_id)],
        );

        let (earliest, latest) = compute_vintage_window(vintage_year)?;

        if unlock_timestamp < earliest || unlock_timestamp > latest {
            return Err(TimeLockError::VintageValidationFailed);
        }

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Civil calendar date arithmetic helpers
// ---------------------------------------------------------------------------

/// Calculates the number of leap years in the closed interval [1, y]
/// according to Gregorian calendar rules.
const fn count_leap_years(y: u64) -> u64 {
    (y / 4) - (y / 100) + (y / 400)
}

/// Returns the Unix timestamp (seconds since 1970-01-01 00:00:00 UTC) for
/// Jan 1 of the given year at 00:00:00 UTC.
///
/// Returns `None` if `year < 1970`.
pub fn jan_1_utc_timestamp(year: u32) -> Option<u64> {
    if year < 1970 {
        return None;
    }
    let y = year as u64;
    // Leap years that have completed strictly prior to year `y`, since 1970-01-01.
    // 1969 is the year immediately before the Unix epoch (1970).
    const LEAP_YEARS_BEFORE_EPOCH: u64 = count_leap_years(1969);
    let leap_years = count_leap_years(y - 1) - LEAP_YEARS_BEFORE_EPOCH;
    let regular_years = y - 1970;
    let days = regular_years * 365 + leap_years;
    Some(days * 86_400)
}

/// Returns the Unix timestamp (seconds since 1970-01-01 00:00:00 UTC) for
/// Dec 31 of the given year at 23:59:59 UTC.
///
/// Returns `None` if `year < 1970` or if `year + 1` overflows.
pub fn dec_31_utc_timestamp(year: u32) -> Option<u64> {
    let next_year = year.checked_add(1)?;
    let next_jan_1 = jan_1_utc_timestamp(next_year)?;
    Some(next_jan_1 - 1)
}

/// Computes the exact civil-calendar UTC unlock timestamp bounds (earliest, latest)
/// for a given vintage year.
///
/// - `earliest`: Jan 1 00:00:00 UTC of `vintage_year + 1` (inclusive)
/// - `latest`: Dec 31 23:59:59 UTC of `vintage_year + 6` (inclusive)
///
/// Uses leap-year-aware civil calendar arithmetic in UTC with reference to the Unix
/// epoch (1970-01-01 00:00:00 UTC). Gregorian leap years are accounted for: every
/// year divisible by 4, except end-of-century years not divisible by 400.
pub fn compute_vintage_window(vintage_year: u32) -> Result<(u64, u64), TimeLockError> {
    if vintage_year < 1970 {
        return Err(TimeLockError::VintageValidationFailed);
    }

    let start_year = vintage_year
        .checked_add(1)
        .ok_or(TimeLockError::VintageValidationFailed)?;
    let end_year = vintage_year
        .checked_add(6)
        .ok_or(TimeLockError::VintageValidationFailed)?;

    let earliest = jan_1_utc_timestamp(start_year)
        .ok_or(TimeLockError::VintageValidationFailed)?;
    let latest = dec_31_utc_timestamp(end_year)
        .ok_or(TimeLockError::VintageValidationFailed)?;

    Ok((earliest, latest))
}

#[cfg(test)]
mod test {
    use super::{
        compute_vintage_window, dec_31_utc_timestamp, jan_1_utc_timestamp, TimeLock,
        TimeLockClient, TimeLockError,
    };
    use soroban_sdk::{
        contract, contractimpl, contracttype, testutils::Address as _, vec, Address, Env, IntoVal,
        Map, Symbol, Vec,
    };
    use soroban_sdk::testutils::Ledger;

    fn setup() -> (Env, Address, Address, TimeLockClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let carbon_asset_contract = Address::generate(&env);
        let contract_id = env.register(TimeLock, ());
        let client = TimeLockClient::new(&env, &contract_id);

        (env, admin, carbon_asset_contract, client)
    }

    #[test]
    fn test_initialize_success() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        let result = client.try_initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        assert_eq!(result, Ok(Ok(())));
    }

    #[test]
    fn test_initialize_twice_returns_already_initialized() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        let result = client.try_initialize(&admin, &carbon_asset_contract, &false, &None, &86400);
        assert_eq!(result, Err(Ok(TimeLockError::AlreadyInitialized)));
    }

    #[test]
    fn test_get_ttl_config() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        let ttl_config = client.get_ttl_config();
        assert!(ttl_config.is_some());
        assert_eq!(ttl_config.unwrap().ttl_seconds, 86400);
    }

    #[test]
    fn test_set_ttl() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        client.set_ttl(&172800);

        let ttl_config = client.get_ttl_config();
        assert!(ttl_config.is_some());
        assert_eq!(ttl_config.unwrap().ttl_seconds, 172800);
    }

    #[test]
    fn test_get_record_count() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        let count = client.get_record_count();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_prune_expired_not_configured() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &0);

        let result = client.try_prune_expired(&1);
        assert_eq!(result, Err(Ok(TimeLockError::TtlNotConfigured)));
    }

    #[test]
    fn test_prune_expired_not_locked() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        let result = client.try_prune_expired(&1);
        assert_eq!(result, Err(Ok(TimeLockError::NotLocked)));
    }

    #[test]
    fn test_batch_prune_expired_empty_batch() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

        let token_ids: Vec<u32> = vec![&_env];
        let result = client.try_batch_prune_expired(&token_ids, &10);
        assert_eq!(result, Err(Ok(TimeLockError::EmptyBatch)));
    }

    #[test]
    fn test_batch_prune_expired_not_configured() {
        let (_env, admin, carbon_asset_contract, client) = setup();

        client.initialize(&admin, &carbon_asset_contract, &false, &None, &0);

        let mut token_ids: Vec<u32> = vec![&_env];
        token_ids.push_back(1);
        let result = client.try_batch_prune_expired(&token_ids, &10);
        assert_eq!(result, Err(Ok(TimeLockError::TtlNotConfigured)));
    }

    // -----------------------------------------------------------------------
    // Regression tests for #522 – specific-token transfer semantics
    // -----------------------------------------------------------------------

    /// Minimal mock CarbonAsset contract that exposes `transfer_token` and
    /// `transfer_token_from` with the same signatures as the real contract.
    /// Records every transfer as `(from, to, token_id)` so the test can
    /// assert exactly which token was moved.
    #[contract]
    pub struct MockCarbonAsset;

    #[contractimpl]
    impl MockCarbonAsset {
        pub fn transfer_token(
            env: Env,
            _from: Address,
            _to: Address,
            token_id: u32,
        ) -> Result<(), crate::TimeLockError> {
            let mut log: Vec<u32> = env
                .storage()
                .instance()
                .get(&MockDataKey::TransferLog)
                .unwrap_or(Vec::new(&env));
            log.push_back(token_id);
            env.storage()
                .instance()
                .set(&MockDataKey::TransferLog, &log);
            Ok(())
        }

        pub fn transfer_token_from(
            env: Env,
            _spender: Address,
            _from: Address,
            _to: Address,
            token_id: u32,
        ) -> Result<(), crate::TimeLockError> {
            let mut log: Vec<u32> = env
                .storage()
                .instance()
                .get(&MockDataKey::TransferLog)
                .unwrap_or(Vec::new(&env));
            log.push_back(token_id);
            env.storage()
                .instance()
                .set(&MockDataKey::TransferLog, &log);
            Ok(())
        }

        pub fn get_transfer_log(env: Env) -> Vec<u32> {
            env.storage()
                .instance()
                .get(&MockDataKey::TransferLog)
                .unwrap_or(Vec::new(&env))
        }

        pub fn fail_next(_env: Env) {
            // Mark next transfer to fail
        }

        pub fn vintage(env: Env, token_id: u32) -> u32 {
            let vintages: Map<u32, u32> = env
                .storage()
                .instance()
                .get(&MockDataKey::Vintages)
                .unwrap_or_else(|| Map::new(&env));
            vintages.get(token_id).unwrap_or(2023)
        }

        pub fn set_vintage(env: Env, token_id: u32, vintage: u32) {
            let mut vintages: Map<u32, u32> = env
                .storage()
                .instance()
                .get(&MockDataKey::Vintages)
                .unwrap_or_else(|| Map::new(&env));
            vintages.set(token_id, vintage);
            env.storage()
                .instance()
                .set(&MockDataKey::Vintages, &vintages);
        }
    }

    #[contracttype]
    enum MockDataKey {
        TransferLog,
        Vintages,
    }

    fn setup_with_mock() -> (Env, Address, Address, TimeLockClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let mock_ca_id = env.register(MockCarbonAsset, ());
        let contract_id = env.register(TimeLock, ());
        let client = TimeLockClient::new(&env, &contract_id);

        (env, admin, mock_ca_id, client)
    }

    #[test]
    fn test_lock_credit_uses_transfer_token_from_with_correct_id() {
        let (env, admin, mock_ca_id, client) = setup_with_mock();

        client.initialize(&admin, &mock_ca_id, &false, &None, &86400);

        let caller = Address::generate(&env);
        let unlock = env.ledger().timestamp() + 1000;

        // Lock token_id = 5 specifically
        client.lock_credit(&caller, &5, &unlock);

        let log: Vec<u32> = env.invoke_contract(
            &mock_ca_id,
            &Symbol::new(&env, "get_transfer_log"),
            vec![&env],
        );

        // Exactly one transfer happened, and it was token_id 5
        assert_eq!(log.len(), 1);
        assert_eq!(log.get(0).unwrap(), 5);
    }

    #[test]
    fn test_release_if_eligible_uses_transfer_token_with_correct_id() {
        let (env, admin, mock_ca_id, client) = setup_with_mock();

        client.initialize(&admin, &mock_ca_id, &false, &None, &86400);

        let caller = Address::generate(&env);
        let unlock = env.ledger().timestamp() + 1000;

        // Lock token_id = 42
        client.lock_credit(&caller, &42, &unlock);

        // Advance past unlock
        env.ledger().with_mut(|l| l.timestamp = unlock + 1);

        client.release_if_eligible(&42);

        let log: Vec<u32> = env.invoke_contract(
            &mock_ca_id,
            &Symbol::new(&env, "get_transfer_log"),
            vec![&env],
        );

        // transfer_token_from (lock) + transfer_token (release) = 2 total
        assert_eq!(log.len(), 2);
        assert_eq!(log.get(0).unwrap(), 42);
        assert_eq!(log.get(1).unwrap(), 42);
    }

    #[test]
    fn test_batch_release_moves_exact_token_ids() {
        let (env, admin, mock_ca_id, client) = setup_with_mock();

        client.initialize(&admin, &mock_ca_id, &false, &None, &86400);

        let caller = Address::generate(&env);
        let unlock = env.ledger().timestamp() + 1000;

        // Lock tokens 10, 20, 30
        client.lock_credit(&caller, &10, &unlock);
        client.lock_credit(&caller, &20, &unlock);
        client.lock_credit(&caller, &30, &unlock);

        // Advance past unlock
        env.ledger().with_mut(|l| l.timestamp = unlock + 1);

        // Batch release: only tokens 10 and 30 (skip 20)
        let mut batch: Vec<u32> = vec![&env];
        batch.push_back(10);
        batch.push_back(30);

        let released = client.batch_release(&batch);

        assert_eq!(released.len(), 2);
        assert_eq!(released.get(0).unwrap(), 10);
        assert_eq!(released.get(1).unwrap(), 30);

        let log: Vec<u32> = env.invoke_contract(
            &mock_ca_id,
            &Symbol::new(&env, "get_transfer_log"),
            vec![&env],
        );

        // 3 locks + 2 releases = 5 total transfers
        assert_eq!(log.len(), 5);
        // Releases should be exactly 10 and 30
        assert_eq!(log.get(3).unwrap(), 10);
        assert_eq!(log.get(4).unwrap(), 30);
    }

    #[test]
    fn test_force_release_moves_exact_token_id() {
        let (env, admin, mock_ca_id, client) = setup_with_mock();

        client.initialize(&admin, &mock_ca_id, &false, &None, &86400);

        let caller = Address::generate(&env);
        // Far-future unlock — force_release should bypass it
        let unlock = env.ledger().timestamp() + 999_999;

        client.lock_credit(&caller, &77, &unlock);

        // Force release (admin already authorized via mock_all_auths)
        client.force_release(&77);

        let log: Vec<u32> = env.invoke_contract(
            &mock_ca_id,
            &Symbol::new(&env, "get_transfer_log"),
            vec![&env],
        );

        // lock (token 77) + force_release (token 77)
        assert_eq!(log.len(), 2);
        assert_eq!(log.get(0).unwrap(), 77);
        assert_eq!(log.get(1).unwrap(), 77);
    }

    #[test]
    fn test_lock_release_lifecycle_removes_record() {
        let (env, admin, mock_ca_id, client) = setup_with_mock();

        client.initialize(&admin, &mock_ca_id, &false, &None, &86400);

        let caller = Address::generate(&env);
        let unlock = env.ledger().timestamp() + 1000;

        client.lock_credit(&caller, &99, &unlock);
        assert_eq!(client.get_record_count(), 1);
        assert!(client.get_lock_status(&99).is_some());

        env.ledger().with_mut(|l| l.timestamp = unlock + 1);
        client.release_if_eligible(&99);

        assert_eq!(client.get_record_count(), 0);
        assert!(client.get_lock_status(&99).is_none());
    }

    // -----------------------------------------------------------------------
    // Unit & Regression tests for #649 – precise date arithmetic for vintage windows
    // -----------------------------------------------------------------------

    #[test]
    fn test_jan_1_utc_timestamp_epoch() {
        assert_eq!(super::jan_1_utc_timestamp(1970), Some(0));
        assert_eq!(super::jan_1_utc_timestamp(1969), None);
    }

    #[test]
    fn test_civil_calendar_leap_years_exact_timestamps() {
        // Non-leap year 1971: 365 days after epoch = 31,536,000
        assert_eq!(super::jan_1_utc_timestamp(1971), Some(31_536_000));
        assert_eq!(super::dec_31_utc_timestamp(1970), Some(31_535_999));

        // Year 2000 is a 400-year leap year:
        // Jan 1 2000 00:00:00 UTC = 946,684,800
        // Dec 31 2000 23:59:59 UTC = 978,307,199 (366 days = 31,622,400 seconds)
        assert_eq!(super::jan_1_utc_timestamp(2000), Some(946_684_800));
        assert_eq!(super::dec_31_utc_timestamp(2000), Some(978_307_199));
        assert_eq!(
            super::jan_1_utc_timestamp(2001).unwrap() - super::jan_1_utc_timestamp(2000).unwrap(),
            366 * 86_400
        );

        // Non-leap year 2023: 365 days = 31,536,000 seconds
        assert_eq!(super::jan_1_utc_timestamp(2023), Some(1_672_531_200));
        assert_eq!(super::dec_31_utc_timestamp(2023), Some(1_704_067_199));

        // Leap year 2024:
        // Jan 1 2024 00:00:00 UTC = 1,704_067_200
        // Dec 31 2024 23:59:59 UTC = 1,735_689_599 (366 days = 31,622,400 seconds)
        assert_eq!(super::jan_1_utc_timestamp(2024), Some(1_704_067_200));
        assert_eq!(super::dec_31_utc_timestamp(2024), Some(1_735_689_599));
        assert_eq!(
            super::jan_1_utc_timestamp(2025).unwrap() - super::jan_1_utc_timestamp(2024).unwrap(),
            366 * 86_400
        );
    }

    #[test]
    fn test_compute_vintage_window_leap_years() {
        // Vintage 2000 (leap year):
        // Window is Jan 1 2001 00:00:00 UTC through Dec 31 2006 23:59:59 UTC
        // Straddles leap years 2000 (prior) and 2004 (inside window)
        let (earliest_2000, latest_2000) = super::compute_vintage_window(2000).unwrap();
        assert_eq!(earliest_2000, 978_307_200);      // Jan 1 2001 00:00:00 UTC
        assert_eq!(latest_2000, 1_167_609_599);     // Dec 31 2006 23:59:59 UTC

        // Vintage 2023 (non-leap year preceding leap year 2024):
        // Window is Jan 1 2024 00:00:00 UTC through Dec 31 2029 23:59:59 UTC
        // Straddles leap years 2024 and 2028 inside the window
        let (earliest_2023, latest_2023) = super::compute_vintage_window(2023).unwrap();
        assert_eq!(earliest_2023, 1_704_067_200);   // Jan 1 2024 00:00:00 UTC
        assert_eq!(latest_2023, 1_893_455_999);     // Dec 31 2029 23:59:59 UTC

        // Vintage 2024 (leap year):
        // Window is Jan 1 2025 00:00:00 UTC through Dec 31 2030 23:59:59 UTC
        // Straddles leap year 2028 inside window
        let (earliest_2024, latest_2024) = super::compute_vintage_window(2024).unwrap();
        assert_eq!(earliest_2024, 1_735_689_600);   // Jan 1 2025 00:00:00 UTC
        assert_eq!(latest_2024, 1_924_991_999);     // Dec 31 2030 23:59:59 UTC
    }

    #[test]
    fn test_regression_old_approximation_divergence() {
        // Under the old 365.25-day approximation:
        // SECONDS_PER_YEAR = 31_557_600
        // For vintage 2023:
        // old earliest = (2024 - 1970) * 31_557_600 = 54 * 31_557_600 = 1_704_110_400
        //
        // However, true Jan 1 2024 00:00:00 UTC is 1_704_067_200.
        // The old approximation was 43,200 seconds (12 hours) late!
        // A timestamp at 06:00:00 UTC on Jan 1 2024 (1_704_088_800):
        // - would have been falsely rejected by the old approximation (1_704_088_800 < 1_704_110_400)
        // - is correctly accepted under the precise civil calendar calculation
        let (earliest_2023, latest_2023) = super::compute_vintage_window(2023).unwrap();
        let valid_unlock_jan1_morning = 1_704_088_800; // 2024-01-01 06:00:00 UTC
        assert!(valid_unlock_jan1_morning >= earliest_2023 && valid_unlock_jan1_morning <= latest_2023);

        const OLD_SECONDS_PER_YEAR: u64 = 31_557_600;
        let old_earliest_2023 = (2023 + 1 - 1970) * OLD_SECONDS_PER_YEAR;
        assert!(valid_unlock_jan1_morning < old_earliest_2023, "Would have failed under old approximation");

        // For vintage 2024:
        // old earliest = (2025 - 1970) * 31_557_600 = 55 * 31_557_600 = 1_735_668_000
        // True Jan 1 2025 00:00:00 UTC is 1_735_689_600.
        // The old approximation was 21,600 seconds (6 hours) too early!
        // A timestamp on Dec 31 2024 at 18:30:00 UTC (1_735_670_000):
        // - would have been falsely accepted by the old approximation (1_735_670_000 >= 1_735_668_000)
        // - is correctly rejected under the precise civil calendar calculation
        let (earliest_2024, _latest_2024) = super::compute_vintage_window(2024).unwrap();
        let premature_unlock_dec31_evening = 1_735_670_000; // 2024-12-31 18:36:40 UTC
        assert!(premature_unlock_dec31_evening < earliest_2024);

        let old_earliest_2024 = (2024 + 1 - 1970) * OLD_SECONDS_PER_YEAR;
        assert!(premature_unlock_dec31_evening >= old_earliest_2024, "Would have falsely passed old approximation");
    }

    #[test]
    fn test_lock_credit_with_vintage_validation_boundary_enforcement() {
        let (env, admin, mock_ca_id, client) = setup_with_mock();
        let mock_ca_client = MockCarbonAssetClient::new(&env, &mock_ca_id);

        // Initialize with vintage validation enabled
        client.initialize(&admin, &mock_ca_id, &true, &None, &86400);

        // Set vintage 2024 for token 100
        mock_ca_client.set_vintage(&100, &2024);

        let caller = Address::generate(&env);
        let (earliest, latest) = super::compute_vintage_window(2024).unwrap();

        // 1 second before earliest (Dec 31 2024 23:59:59 UTC) -> fails
        let res_before = client.try_lock_credit(&caller, &100, &(earliest - 1));
        assert_eq!(res_before, Err(Ok(TimeLockError::VintageValidationFailed)));

        // 1 second after latest (Jan 1 2031 00:00:00 UTC) -> fails
        let res_after = client.try_lock_credit(&caller, &100, &(latest + 1));
        assert_eq!(res_after, Err(Ok(TimeLockError::VintageValidationFailed)));

        // Exactly earliest (Jan 1 2025 00:00:00 UTC) -> succeeds
        let res_earliest = client.try_lock_credit(&caller, &100, &earliest);
        assert_eq!(res_earliest, Ok(Ok(())));

        // Set vintage 2024 for token 101, lock at latest (Dec 31 2030 23:59:59 UTC) -> succeeds
        mock_ca_client.set_vintage(&101, &2024);
        let res_latest = client.try_lock_credit(&caller, &101, &latest);
        assert_eq!(res_latest, Ok(Ok(())));
    }
}
