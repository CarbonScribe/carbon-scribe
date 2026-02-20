#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short,
    token::Client as TokenClient, vec, Address, Env, Map, Vec,
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
    pub fn initialize(
        env: Env,
        admin: Address,
        carbon_asset_contract: Address,
        validate_vintage: bool,
        vintage_check_contract: Option<Address>,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
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

        let token_client = TokenClient::new(&env, &ca_contract);

        token_client.transfer_from(
            &env.current_contract_address(),
            &caller,
            &env.current_contract_address(),
            &(token_id as i128),
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

        let token_client = TokenClient::new(&env, &ca_contract);
        token_client.transfer(
            &env.current_contract_address(),
            &record.owner,
            &(token_id as i128),
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
        let token_client = TokenClient::new(&env, &ca_contract);

        let mut released: Vec<u32> = vec![&env];

        for token_id in token_ids.iter() {
            if let Some(record) = records.get(token_id) {
                if now >= record.unlock_timestamp {
                    token_client.transfer(
                        &env.current_contract_address(),
                        &record.owner,
                        &(token_id as i128),
                    );

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

        let token_client = TokenClient::new(&env, &ca_contract);
        token_client.transfer(
            &env.current_contract_address(),
            &record.owner,
            &(token_id as i128),
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
    /// The vintage year defines the calendar year in which sequestration
    /// occurred. We require that:
    ///   Jan 1 of (vintage_year + 1) ≤ unlock_timestamp ≤ Dec 31 of (vintage_year + 5)
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

        // Earliest valid unlock: 1 Jan of (vintage_year + 1) 00:00 UTC
        // Approximation: each year ≈ 365.25 days → 31_557_600 seconds.
        // Reference epoch: Unix 0 = 1 Jan 1970.
        const SECONDS_PER_YEAR: u64 = 31_557_600;
        let base_year: u64 = 1970;
        let earliest: u64 = (vintage_year as u64 + 1 - base_year) * SECONDS_PER_YEAR;
        let latest: u64 = (vintage_year as u64 + 6 - base_year) * SECONDS_PER_YEAR;

        if unlock_timestamp < earliest || unlock_timestamp > latest {
            return Err(TimeLockError::VintageValidationFailed);
        }

        Ok(())
    }
}
