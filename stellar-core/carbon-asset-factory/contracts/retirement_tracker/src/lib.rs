#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, BytesN, Env, IntoVal, String,
    Symbol, Vec,
};

// ========================================================================
// Batch Size Limits (issue #559)
// ========================================================================

/// Maximum number of tokens accepted by `batch_retire` /
/// `batch_retire_with_tx_hashes` in a single call.
///
/// Each element performs a full cross-contract `burn_token` invocation
/// (`retire_internal`), plus persistent-storage reads/writes for the
/// retirement ledger and the per-entity index, and one event publish.
/// Soroban transactions are capped at 100,000,000 CPU instructions; a
/// single retirement (cross-contract call + storage I/O + event) has been
/// budgeted at well under 1,000,000 instructions in practice, so 100
/// elements per batch leaves comfortable headroom before the ceiling and
/// keeps a single oversized batch from being able to exhaust the budget
/// mid-transaction. Tune this constant (not the loop logic) if measured
/// per-element cost changes.
pub const MAX_BATCH_SIZE: u32 = 100;

// ========================================================================
// Data Structures
// ========================================================================

/// Core retirement record (immutable once written)
#[derive(Clone, Debug)]
#[contracttype]
pub struct RetirementRecord {
    pub token_id: u32,               // ID of the retired CarbonAsset
    pub retiring_entity: Address,    // Stellar account who retired the credit
    pub timestamp: u64,              // Ledger timestamp of retirement
    pub tx_hash: Option<BytesN<32>>, // Actual transaction hash when supplied by the caller
    pub event_nonce: u64,            // Contract-scoped unique event sequence
    pub reason: Option<String>,      // Optional field for corporate reporting
}

/// Storage keys for the contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    CarbonAssetContract,
    EventNonce,
    RetirementLedger(u32), // token_id -> RetirementRecord
    EntityIndex(Address),  // retiring_entity -> Vec<u32>
}

// ========================================================================
// Contract Errors
// ========================================================================

pub mod errors;
pub use errors::ContractError;

// ========================================================================
// Batch Result & Failure Reporting (issue #518)
// ========================================================================

/// Reason a single token failed during a batch retirement. Mirrors the
/// `ContractError` discriminants but is a regular contract type, so it can be
/// serialized in the batch return value. Use [`From<ContractError>`] to map a
/// failure into this type.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RetirementFailureReason {
    NotAuthorized = 1,
    TokenNotOwned = 2,
    TokenAlreadyRetired = 3,
    InvalidTokenId = 4,
    BurnFailed = 5,
    ContractNotInitialized = 6,
    EventNonceOverflow = 7,
    AlreadyInitialized = 8,
    BatchTooLarge = 9,
    BatchLengthMismatch = 10,
}

impl From<ContractError> for RetirementFailureReason {
    fn from(err: ContractError) -> Self {
        match err {
            ContractError::NotAuthorized => Self::NotAuthorized,
            ContractError::TokenNotOwned => Self::TokenNotOwned,
            ContractError::TokenAlreadyRetired => Self::TokenAlreadyRetired,
            ContractError::InvalidTokenId => Self::InvalidTokenId,
            ContractError::BurnFailed => Self::BurnFailed,
            ContractError::ContractNotInitialized => Self::ContractNotInitialized,
            ContractError::EventNonceOverflow => Self::EventNonceOverflow,
            ContractError::AlreadyInitialized => Self::AlreadyInitialized,
            ContractError::BatchTooLarge => Self::BatchTooLarge,
            ContractError::BatchLengthMismatch => Self::BatchLengthMismatch,
        }
    }
}

/// Aggregate result of a batch retirement. Reports both the tokens that were
/// successfully retired and the individual tokens that failed, together with
/// the reason each one failed.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct BatchRetireResult {
    pub succeeded: Vec<RetirementRecord>,
    pub failed: Vec<(u32, RetirementFailureReason)>,
}

// ========================================================================
// Events
// ========================================================================

#[contractevent]
pub struct RetirementEvent {
    pub token_id: u32,
    pub retiring_entity: Address,
    pub timestamp: u64,
    pub tx_hash: Option<BytesN<32>>,
    pub event_nonce: u64,
}

/// Emitted for each token that fails during a batch retirement, so failures
/// are observable on-chain even if the caller ignores the return value.
#[contractevent(data_format = "single-value")]
pub struct RetirementFailedEvent {
    #[topic]
    pub token_id: u32,
    pub reason: RetirementFailureReason,
}

#[contractevent]
pub struct ContractUpdatedEvent {
    pub old_contract: Address,
    pub new_contract: Address,
    pub updated_by: Address,
}

#[contractevent]
pub struct InitializationEvent {
    pub admin: Address,
    pub carbon_asset_contract: Address,
}

#[contractevent]
pub struct ReinitializationBlockedEvent {
    pub attempted_admin: Address,
}

// ========================================================================
// Contract Implementation
// ========================================================================

#[contract]
pub struct RetirementTracker;

#[contractimpl]
impl RetirementTracker {
    /// Initialize the contract
    ///
    /// # Arguments
    /// * `admin` - CarbonScribe admin address
    /// * `carbon_asset_contract` - Address of the CarbonAsset contract
    pub fn initialize(
        env: Env,
        admin: Address,
        carbon_asset_contract: Address,
    ) -> Result<(), ContractError> {
        admin.require_auth();

        // Check if already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            ReinitializationBlockedEvent {
                attempted_admin: admin,
            }
            .publish(&env);
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CarbonAssetContract, &carbon_asset_contract);
        env.storage().instance().set(&DataKey::EventNonce, &0u64);

        InitializationEvent {
            admin,
            carbon_asset_contract,
        }
        .publish(&env);

        Ok(())
    }

    /// Check if the contract has been initialized.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    /// Retire a single carbon credit token
    ///
    /// # Arguments
    /// * `token_id` - The ID of the CarbonAsset token to retire
    /// * `retiring_entity` - The Stellar account address retiring the credit
    /// * `reason` - Optional reason for retirement (for corporate reporting)
    ///
    /// # Returns
    /// The RetirementRecord created for this retirement
    ///
    /// # Errors
    /// * `ContractError::TokenNotOwned` - Caller does not own the token
    /// * `ContractError::TokenAlreadyRetired` - Token has already been retired
    /// * `ContractError::BurnFailed` - Failed to burn the token
    pub fn retire(
        env: Env,
        token_id: u32,
        retiring_entity: Address,
        reason: Option<String>,
    ) -> Result<RetirementRecord, ContractError> {
        retiring_entity.require_auth();
        Self::retire_internal(env, token_id, retiring_entity, reason, None)
    }

    /// Retire a single carbon credit token with the actual transaction hash
    /// supplied by the caller or integration layer.
    pub fn retire_with_tx_hash(
        env: Env,
        token_id: u32,
        retiring_entity: Address,
        reason: Option<String>,
        tx_hash: BytesN<32>,
    ) -> Result<RetirementRecord, ContractError> {
        retiring_entity.require_auth();
        Self::retire_internal(env, token_id, retiring_entity, reason, Some(tx_hash))
    }

    fn retire_internal(
        env: Env,
        token_id: u32,
        retiring_entity: Address,
        reason: Option<String>,
        tx_hash: Option<BytesN<32>>,
    ) -> Result<RetirementRecord, ContractError> {
        // Check if token is already retired
        let ledger_key = DataKey::RetirementLedger(token_id);
        if env.storage().persistent().has(&ledger_key) {
            return Err(ContractError::TokenAlreadyRetired);
        }

        // Get carbon asset contract address
        let carbon_asset_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(ContractError::ContractNotInitialized)?;

        // Get current timestamp
        let timestamp = env.ledger().timestamp();

        // Call burn_token on CarbonAsset contract
        // The contract must be pre-authorized as a burner on the CarbonAsset contract
        // We assume CarbonAsset has a burn_token function that accepts (token_id: u32, from: Address)
        // The CarbonAsset contract should verify ownership before allowing burn
        let burn_symbol = Symbol::new(&env, "burn_token");
        let mut burn_args = Vec::new(&env);
        burn_args.push_back(token_id.into_val(&env));
        burn_args.push_back(retiring_entity.clone().into_val(&env));
        env.invoke_contract::<()>(&carbon_asset_contract, &burn_symbol, burn_args);

        let event_nonce = Self::next_event_nonce(&env)?;

        // Create retirement record
        let record = RetirementRecord {
            token_id,
            retiring_entity: retiring_entity.clone(),
            timestamp,
            tx_hash: tx_hash.clone(),
            event_nonce,
            reason: reason.clone(),
        };

        // Store in retirement ledger
        env.storage().persistent().set(&ledger_key, &record);

        // Update entity index
        let entity_key = DataKey::EntityIndex(retiring_entity.clone());
        let mut entity_retirements: Vec<u32> = env
            .storage()
            .persistent()
            .get(&entity_key)
            .unwrap_or(Vec::new(&env));
        entity_retirements.push_back(token_id);
        env.storage()
            .persistent()
            .set(&entity_key, &entity_retirements);

        // Emit event
        RetirementEvent {
            token_id,
            retiring_entity: retiring_entity.clone(),
            timestamp,
            tx_hash,
            event_nonce,
        }
        .publish(&env);
        Ok(record)
    }

    /// Retire multiple carbon credit tokens in a single transaction
    ///
    /// # Arguments
    /// * `token_ids` - Vector of token IDs to retire
    /// * `retiring_entity` - The Stellar account address retiring the credits
    /// * `reason` - Optional reason for retirement (applied to all tokens)
    ///
    /// # Returns
    /// A `BatchRetireResult` containing the successful `RetirementRecord`s in
    /// `succeeded` and, for every token that failed, a `(token_id, reason)`
    /// pair in `failed` describing exactly which token failed and why. Each
    /// failure also emits a `RetirementFailedEvent`. Processing continues past
    /// individual failures, so one invalid token does not abort the batch.
    ///
    /// # Errors
    /// * `ContractError::BatchTooLarge` - `token_ids.len()` exceeds
    ///   `MAX_BATCH_SIZE`; rejected before any cross-contract call is made.
    pub fn batch_retire(
        env: Env,
        token_ids: Vec<u32>,
        retiring_entity: Address,
        reason: Option<String>,
    ) -> Result<BatchRetireResult, ContractError> {
        retiring_entity.require_auth();

        if token_ids.len() > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }

        let mut succeeded = Vec::new(&env);
        let mut failed = Vec::new(&env);

        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();

            // Attempt to retire each token
            // Continue even if one fails
            match Self::retire_internal(
                env.clone(),
                token_id,
                retiring_entity.clone(),
                reason.clone(),
                None,
            ) {
                Ok(record) => succeeded.push_back(record),
                Err(err) => {
                    let reason: RetirementFailureReason = err.into();
                    RetirementFailedEvent { token_id, reason }.publish(&env);
                    failed.push_back((token_id, reason));
                }
            }
        }

        Ok(BatchRetireResult { succeeded, failed })
    }

    /// Retire multiple carbon credit tokens with caller-supplied transaction
    /// hashes. Each successful retirement receives its own event nonce.
    ///
    /// # Returns
    /// A `BatchRetireResult` containing the successful `RetirementRecord`s in
    /// `succeeded` and, for every token that failed, a `(token_id, reason)`
    /// pair in `failed` describing exactly which token failed and why. Each
    /// failure also emits a `RetirementFailedEvent`. Processing continues past
    /// individual failures, so one invalid token does not abort the batch.
    ///
    /// # Errors
    /// * `ContractError::BatchTooLarge` - `token_ids.len()` or
    ///   `tx_hashes.len()` exceeds `MAX_BATCH_SIZE`; rejected before any
    ///   cross-contract call is made.
    /// * `ContractError::BatchLengthMismatch` - `token_ids` and `tx_hashes`
    ///   have different lengths. Previously this silently truncated to the
    ///   shorter of the two; it is now a hard rejection instead.
    pub fn batch_retire_with_tx_hashes(
        env: Env,
        token_ids: Vec<u32>,
        retiring_entity: Address,
        reason: Option<String>,
        tx_hashes: Vec<BytesN<32>>,
    ) -> Result<BatchRetireResult, ContractError> {
        retiring_entity.require_auth();

        if token_ids.len() > MAX_BATCH_SIZE || tx_hashes.len() > MAX_BATCH_SIZE {
            return Err(ContractError::BatchTooLarge);
        }
        if token_ids.len() != tx_hashes.len() {
            return Err(ContractError::BatchLengthMismatch);
        }

        let mut succeeded = Vec::new(&env);
        let mut failed = Vec::new(&env);

        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            let tx_hash = tx_hashes.get(i).unwrap();

            // Attempt to retire each token
            // Continue even if one fails
            match Self::retire_internal(
                env.clone(),
                token_id,
                retiring_entity.clone(),
                reason.clone(),
                Some(tx_hash),
            ) {
                Ok(record) => succeeded.push_back(record),
                Err(err) => {
                    let reason: RetirementFailureReason = err.into();
                    RetirementFailedEvent { token_id, reason }.publish(&env);
                    failed.push_back((token_id, reason));
                }
            }
        }

        Ok(BatchRetireResult { succeeded, failed })
    }

    /// Check if a token has been retired
    ///
    /// # Arguments
    /// * `token_id` - The token ID to check
    ///
    /// # Returns
    /// `true` if the token is retired, `false` otherwise
    pub fn is_retired(env: Env, token_id: u32) -> bool {
        let ledger_key = DataKey::RetirementLedger(token_id);
        env.storage().persistent().has(&ledger_key)
    }

    /// Get the full retirement record for a token
    ///
    /// # Arguments
    /// * `token_id` - The token ID to query
    ///
    /// # Returns
    /// `Some(RetirementRecord)` if the token is retired, `None` otherwise
    pub fn get_retirement_record(env: Env, token_id: u32) -> Option<RetirementRecord> {
        let ledger_key = DataKey::RetirementLedger(token_id);
        env.storage().persistent().get(&ledger_key)
    }

    /// Get all token IDs retired by a specific entity
    ///
    /// # Arguments
    /// * `retiring_entity` - The address to query
    ///
    /// # Returns
    /// Vector of token IDs retired by the entity
    pub fn get_retirements_by_entity(env: Env, retiring_entity: Address) -> Vec<u32> {
        let entity_key = DataKey::EntityIndex(retiring_entity);
        env.storage()
            .persistent()
            .get(&entity_key)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the latest contract-scoped event nonce.
    pub fn get_event_nonce(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::EventNonce)
            .unwrap_or(0u64)
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /// Update the linked CarbonAsset contract address
    ///
    /// # Arguments
    /// * `new_contract` - The new CarbonAsset contract address
    ///
    /// # Errors
    /// * `ContractError::NotAuthorized` - Caller is not the admin
    pub fn update_carbon_asset_contract(
        env: Env,
        caller: Address,
        new_contract: Address,
    ) -> Result<(), ContractError> {
        // Require auth for admin function
        caller.require_auth();

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::ContractNotInitialized)?;

        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        let old_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(ContractError::ContractNotInitialized)?;

        env.storage()
            .instance()
            .set(&DataKey::CarbonAssetContract, &new_contract);

        // Emit event
        ContractUpdatedEvent {
            old_contract,
            new_contract,
            updated_by: caller,
        }
        .publish(&env);
        Ok(())
    }

    /// Get the current admin address
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Get the current CarbonAsset contract address
    pub fn get_carbon_asset_contract(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::CarbonAssetContract)
    }

    fn next_event_nonce(env: &Env) -> Result<u64, ContractError> {
        let current = env
            .storage()
            .instance()
            .get(&DataKey::EventNonce)
            .unwrap_or(0u64);
        let next = current
            .checked_add(1)
            .ok_or(ContractError::EventNonceOverflow)?;
        env.storage().instance().set(&DataKey::EventNonce, &next);
        Ok(next)
    }
}

#[cfg(test)]
mod test {
    use super::{
        ContractError, RetirementFailureReason, RetirementTracker, RetirementTrackerClient,
        MAX_BATCH_SIZE,
    };
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::testutils::Events as _;
    use soroban_sdk::{
        contract, contractimpl, Address, BytesN, Env, String, Symbol, TryFromVal, Vec,
    };

    #[contract]
    pub struct MockCarbonAsset;

    #[contractimpl]
    impl MockCarbonAsset {
        pub fn burn_token(_env: Env, _token_id: u32, _from: Address) {}
    }

    fn setup() -> (Env, RetirementTrackerClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let retiring_entity = Address::generate(&env);
        let asset_contract = env.register(MockCarbonAsset, ());
        let tracker_contract = env.register(RetirementTracker, ());
        let client = RetirementTrackerClient::new(&env, &tracker_contract);

        client.initialize(&admin, &asset_contract);

        (env, client, retiring_entity)
    }

    /// Collect the `(token_id, reason)` pairs from every emitted
    /// `RetirementFailedEvent`.
    fn failed_batch_events(env: &Env) -> Vec<(u32, RetirementFailureReason)> {
        let failed_symbol = Symbol::new(env, "retirement_failed_event");
        let events = env.events().all();
        let mut failures = Vec::new(env);
        for i in 0..events.len() {
            let (_, topics, data) = events.get(i).unwrap();
            if topics
                .get(0)
                .is_some_and(|t| Symbol::try_from_val(env, &t) == Ok(failed_symbol.clone()))
            {
                let token_id = u32::try_from_val(env, &topics.get(1).unwrap()).unwrap();
                let reason = RetirementFailureReason::try_from_val(env, &data).unwrap();
                failures.push_back((token_id, reason));
            }
        }
        failures
    }

    #[test]
    fn retire_with_tx_hash_records_actual_hash_and_nonce() {
        let (env, client, retiring_entity) = setup();
        let tx_hash = BytesN::from_array(&env, &[7u8; 32]);

        let record = client.retire_with_tx_hash(
            &1,
            &retiring_entity,
            &Some(String::from_str(&env, "annual offset")),
            &tx_hash,
        );

        assert_eq!(record.token_id, 1);
        assert_eq!(record.tx_hash, Some(tx_hash.clone()));
        assert_eq!(record.event_nonce, 1);
        assert_eq!(client.get_event_nonce(), 1);

        let stored = client.get_retirement_record(&1).unwrap();
        assert_eq!(stored.tx_hash, Some(tx_hash));
        assert_eq!(stored.event_nonce, 1);
    }

    #[test]
    fn retire_without_tx_hash_uses_nonce_fallback() {
        let (_env, client, retiring_entity) = setup();

        let first = client.retire(&1, &retiring_entity, &None);
        let second = client.retire(&2, &retiring_entity, &None);

        assert_eq!(first.tx_hash, None);
        assert_eq!(first.event_nonce, 1);
        assert_eq!(second.tx_hash, None);
        assert_eq!(second.event_nonce, 2);
        assert_eq!(client.get_event_nonce(), 2);
    }

    #[test]
    fn duplicate_retirement_is_rejected_without_consuming_nonce() {
        let (_env, client, retiring_entity) = setup();

        let record = client.retire(&1, &retiring_entity, &None);
        assert_eq!(record.event_nonce, 1);

        let duplicate = client.try_retire(&1, &retiring_entity, &None);
        assert!(duplicate.is_err());
        assert_eq!(client.get_event_nonce(), 1);
    }

    #[test]
    fn batch_retire_with_tx_hashes_assigns_ordered_nonces() {
        let (env, client, retiring_entity) = setup();
        let mut token_ids = Vec::new(&env);
        token_ids.push_back(1);
        token_ids.push_back(2);

        let first_hash = BytesN::from_array(&env, &[1u8; 32]);
        let second_hash = BytesN::from_array(&env, &[2u8; 32]);
        let mut tx_hashes = Vec::new(&env);
        tx_hashes.push_back(first_hash.clone());
        tx_hashes.push_back(second_hash.clone());

        let result =
            client.batch_retire_with_tx_hashes(&token_ids, &retiring_entity, &None, &tx_hashes);

        assert_eq!(result.succeeded.len(), 2);
        assert!(result.failed.is_empty());
        assert_eq!(result.succeeded.get(0).unwrap().tx_hash, Some(first_hash));
        assert_eq!(result.succeeded.get(0).unwrap().event_nonce, 1);
        assert_eq!(result.succeeded.get(1).unwrap().tx_hash, Some(second_hash));
        assert_eq!(result.succeeded.get(1).unwrap().event_nonce, 2);
        assert_eq!(client.get_event_nonce(), 2);
    }

    // ====================================================================
    // Batch size limit tests (issue #559)
    // ====================================================================

    fn make_token_ids(env: &Env, count: u32) -> Vec<u32> {
        let mut ids = Vec::new(env);
        for i in 0..count {
            ids.push_back(i + 1);
        }
        ids
    }

    fn make_tx_hashes(env: &Env, count: u32) -> Vec<BytesN<32>> {
        let mut hashes = Vec::new(env);
        for i in 0..count {
            let byte = (i % 256) as u8;
            hashes.push_back(BytesN::from_array(env, &[byte; 32]));
        }
        hashes
    }

    #[test]
    fn batch_retire_at_exactly_max_batch_size_succeeds() {
        let (env, client, retiring_entity) = setup();
        let token_ids = make_token_ids(&env, MAX_BATCH_SIZE);

        let result = client.batch_retire(&token_ids, &retiring_entity, &None);
        assert_eq!(result.succeeded.len(), MAX_BATCH_SIZE);
        assert!(result.failed.is_empty());
    }

    #[test]
    fn batch_retire_over_max_batch_size_is_rejected() {
        let (env, client, retiring_entity) = setup();
        let token_ids = make_token_ids(&env, MAX_BATCH_SIZE + 1);

        let result = client.try_batch_retire(&token_ids, &retiring_entity, &None);
        assert_eq!(result, Err(Ok(ContractError::BatchTooLarge)));

        // No cross-contract burn / retirement should have happened for any
        // token in the rejected batch.
        assert!(client.get_retirement_record(&1).is_none());
    }

    #[test]
    fn batch_retire_empty_batch_returns_empty_vec() {
        let (env, client, retiring_entity) = setup();
        let token_ids: Vec<u32> = Vec::new(&env);

        let result = client.batch_retire(&token_ids, &retiring_entity, &None);
        assert_eq!(result.succeeded.len(), 0);
        assert!(result.failed.is_empty());
    }

    #[test]
    fn batch_retire_with_tx_hashes_at_exactly_max_batch_size_succeeds() {
        let (env, client, retiring_entity) = setup();
        let token_ids = make_token_ids(&env, MAX_BATCH_SIZE);
        let tx_hashes = make_tx_hashes(&env, MAX_BATCH_SIZE);

        let result =
            client.batch_retire_with_tx_hashes(&token_ids, &retiring_entity, &None, &tx_hashes);
        assert_eq!(result.succeeded.len(), MAX_BATCH_SIZE);
        assert!(result.failed.is_empty());
    }

    #[test]
    fn batch_retire_with_tx_hashes_over_max_batch_size_is_rejected() {
        let (env, client, retiring_entity) = setup();
        let token_ids = make_token_ids(&env, MAX_BATCH_SIZE + 1);
        let tx_hashes = make_tx_hashes(&env, MAX_BATCH_SIZE + 1);

        let result =
            client.try_batch_retire_with_tx_hashes(&token_ids, &retiring_entity, &None, &tx_hashes);
        assert_eq!(result, Err(Ok(ContractError::BatchTooLarge)));
        assert!(client.get_retirement_record(&1).is_none());
    }

    #[test]
    fn batch_retire_with_tx_hashes_mismatched_lengths_is_rejected() {
        let (env, client, retiring_entity) = setup();
        let token_ids = make_token_ids(&env, 3);
        // Fewer tx_hashes than token_ids — previously this silently
        // truncated to the shorter length instead of rejecting.
        let tx_hashes = make_tx_hashes(&env, 2);

        let result =
            client.try_batch_retire_with_tx_hashes(&token_ids, &retiring_entity, &None, &tx_hashes);
        assert_eq!(result, Err(Ok(ContractError::BatchLengthMismatch)));

        // Nothing from the rejected batch should have been recorded.
        assert!(client.get_retirement_record(&1).is_none());
        assert!(client.get_retirement_record(&2).is_none());
        assert!(client.get_retirement_record(&3).is_none());
    }

    // ====================================================================
    // Per-token failure reporting tests (issue #518)
    // ====================================================================

    #[test]
    fn batch_retire_all_success_reports_no_failures() {
        let (env, client, retiring_entity) = setup();
        let mut token_ids = Vec::new(&env);
        token_ids.push_back(1);
        token_ids.push_back(2);
        token_ids.push_back(3);

        let result = client.batch_retire(&token_ids, &retiring_entity, &None);

        assert_eq!(result.succeeded.len(), 3);
        assert!(result.failed.is_empty());
        assert_eq!(result.succeeded.get(0).unwrap().event_nonce, 1);
        assert_eq!(result.succeeded.get(1).unwrap().event_nonce, 2);
        assert_eq!(result.succeeded.get(2).unwrap().event_nonce, 3);
        assert!(failed_batch_events(&env).is_empty());
        assert_eq!(client.get_event_nonce(), 3);
    }

    #[test]
    fn batch_retire_all_failures_reports_each_token_and_reason() {
        let (env, client, retiring_entity) = setup();

        client.retire(&1, &retiring_entity, &None);
        client.retire(&2, &retiring_entity, &None);

        let mut token_ids = Vec::new(&env);
        token_ids.push_back(1);
        token_ids.push_back(2);

        let result = client.batch_retire(&token_ids, &retiring_entity, &None);

        assert!(result.succeeded.is_empty());
        assert_eq!(result.failed.len(), 2);
        assert_eq!(
            result.failed.get(0).unwrap(),
            (1, RetirementFailureReason::TokenAlreadyRetired)
        );
        assert_eq!(
            result.failed.get(1).unwrap(),
            (2, RetirementFailureReason::TokenAlreadyRetired)
        );

        let events = failed_batch_events(&env);
        assert_eq!(events.len(), 2);
        assert_eq!(
            events.get(0).unwrap(),
            (1, RetirementFailureReason::TokenAlreadyRetired)
        );
        assert_eq!(
            events.get(1).unwrap(),
            (2, RetirementFailureReason::TokenAlreadyRetired)
        );
    }

    #[test]
    fn batch_retire_mixed_reports_which_ids_failed_and_succeeded() {
        let (env, client, retiring_entity) = setup();

        client.retire(&1, &retiring_entity, &None);

        let mut token_ids = Vec::new(&env);
        token_ids.push_back(1);
        token_ids.push_back(2);
        token_ids.push_back(3);

        let result = client.batch_retire(&token_ids, &retiring_entity, &None);

        assert_eq!(result.succeeded.len(), 2);
        assert_eq!(result.succeeded.get(0).unwrap().token_id, 2);
        assert_eq!(result.succeeded.get(1).unwrap().token_id, 3);
        assert_eq!(result.succeeded.get(0).unwrap().event_nonce, 2);
        assert_eq!(result.succeeded.get(1).unwrap().event_nonce, 3);
        assert_eq!(result.failed.len(), 1);
        assert_eq!(
            result.failed.get(0).unwrap(),
            (1, RetirementFailureReason::TokenAlreadyRetired)
        );

        let events = failed_batch_events(&env);
        assert_eq!(events.len(), 1);
        assert_eq!(
            events.get(0).unwrap(),
            (1, RetirementFailureReason::TokenAlreadyRetired)
        );
        assert_eq!(client.get_event_nonce(), 3);
    }

    #[test]
    fn batch_retire_with_tx_hashes_reports_failures() {
        let (env, client, retiring_entity) = setup();

        client.retire(&1, &retiring_entity, &None);

        let mut token_ids = Vec::new(&env);
        token_ids.push_back(1);
        token_ids.push_back(2);

        let hash = BytesN::from_array(&env, &[7u8; 32]);
        let mut tx_hashes = Vec::new(&env);
        tx_hashes.push_back(hash.clone());
        tx_hashes.push_back(hash.clone());

        let result =
            client.batch_retire_with_tx_hashes(&token_ids, &retiring_entity, &None, &tx_hashes);

        assert_eq!(result.succeeded.len(), 1);
        assert_eq!(result.succeeded.get(0).unwrap().token_id, 2);
        assert_eq!(result.succeeded.get(0).unwrap().tx_hash, Some(hash));
        assert_eq!(result.failed.len(), 1);
        assert_eq!(
            result.failed.get(0).unwrap(),
            (1, RetirementFailureReason::TokenAlreadyRetired)
        );

        let events = failed_batch_events(&env);
        assert_eq!(events.len(), 1);
        assert_eq!(
            events.get(0).unwrap(),
            (1, RetirementFailureReason::TokenAlreadyRetired)
        );
    }

    #[test]
    fn test_initialize_twice_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let asset_contract = Address::generate(&env);
        let tracker_contract = env.register(RetirementTracker, ());
        let client = RetirementTrackerClient::new(&env, &tracker_contract);

        // First initialization succeeds
        assert!(!client.is_initialized());
        client.initialize(&admin, &asset_contract);
        assert!(client.is_initialized());

        // Second initialization fails
        let result = client.try_initialize(&admin, &asset_contract);
        assert!(result.is_err());
    }
}
