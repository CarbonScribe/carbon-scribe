#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env,
    IntoVal, String, Symbol, Vec,
};

// ========================================================================
// Data Structures
// ========================================================================

/// Core retirement record (immutable once written)
#[derive(Clone)]
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

#[derive(Clone, Copy)]
#[contracterror]
pub enum ContractError {
    NotAuthorized = 1,
    TokenNotOwned = 2,
    TokenAlreadyRetired = 3,
    InvalidTokenId = 4,
    BurnFailed = 5,
    ContractNotInitialized = 6,
    EventNonceOverflow = 7,
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

#[contractevent]
pub struct ContractUpdatedEvent {
    pub old_contract: Address,
    pub new_contract: Address,
    pub updated_by: Address,
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
    pub fn initialize(env: Env, admin: Address, carbon_asset_contract: Address) {
        admin.require_auth();

        // Check if already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CarbonAssetContract, &carbon_asset_contract);
        env.storage().instance().set(&DataKey::EventNonce, &0u64);
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
    /// Vector of RetirementRecords created
    ///
    /// # Errors
    /// Returns errors for individual tokens that fail, but continues processing others
    pub fn batch_retire(
        env: Env,
        token_ids: Vec<u32>,
        retiring_entity: Address,
        reason: Option<String>,
    ) -> Vec<RetirementRecord> {
        retiring_entity.require_auth();

        let mut results = Vec::new(&env);

        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();

            // Attempt to retire each token
            // Continue even if one fails
            if let Ok(record) = Self::retire_internal(
                env.clone(),
                token_id,
                retiring_entity.clone(),
                reason.clone(),
                None,
            ) {
                results.push_back(record);
            }
        }

        results
    }

    /// Retire multiple carbon credit tokens with caller-supplied transaction
    /// hashes. Each successful retirement receives its own event nonce.
    pub fn batch_retire_with_tx_hashes(
        env: Env,
        token_ids: Vec<u32>,
        retiring_entity: Address,
        reason: Option<String>,
        tx_hashes: Vec<BytesN<32>>,
    ) -> Vec<RetirementRecord> {
        retiring_entity.require_auth();

        let mut results = Vec::new(&env);

        for i in 0..token_ids.len() {
            if i >= tx_hashes.len() {
                break;
            }

            let token_id = token_ids.get(i).unwrap();
            let tx_hash = tx_hashes.get(i).unwrap();

            if let Ok(record) = Self::retire_internal(
                env.clone(),
                token_id,
                retiring_entity.clone(),
                reason.clone(),
                Some(tx_hash),
            ) {
                results.push_back(record);
            }
        }

        results
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
    use super::{RetirementTracker, RetirementTrackerClient};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

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

        let records =
            client.batch_retire_with_tx_hashes(&token_ids, &retiring_entity, &None, &tx_hashes);

        assert_eq!(records.len(), 2);
        assert_eq!(records.get(0).unwrap().tx_hash, Some(first_hash));
        assert_eq!(records.get(0).unwrap().event_nonce, 1);
        assert_eq!(records.get(1).unwrap().tx_hash, Some(second_hash));
        assert_eq!(records.get(1).unwrap().event_nonce, 2);
        assert_eq!(client.get_event_nonce(), 2);
    }
}
