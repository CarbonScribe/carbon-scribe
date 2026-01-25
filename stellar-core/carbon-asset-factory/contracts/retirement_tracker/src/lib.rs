#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Bytes, BytesN,
    Env, IntoVal, String, Symbol, Vec,
};

// ========================================================================
// Data Structures
// ========================================================================

/// Core retirement record (immutable once written)
#[derive(Clone)]
#[contracttype]
pub struct RetirementRecord {
    pub token_id: u32,            // ID of the retired CarbonAsset
    pub retiring_entity: Address, // Stellar account who retired the credit
    pub timestamp: u64,           // Ledger timestamp of retirement
    pub tx_hash: BytesN<32>,      // Hash of the retirement transaction
    pub reason: Option<String>,   // Optional field for corporate reporting
}

/// Storage keys for the contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    CarbonAssetContract,
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
}

// ========================================================================
// Events
// ========================================================================

#[contractevent]
pub struct RetirementEvent {
    pub token_id: u32,
    pub retiring_entity: Address,
    pub timestamp: u64,
    pub tx_hash: BytesN<32>,
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
        // Verify caller is authenticated
        retiring_entity.require_auth();

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

        // Generate a unique transaction hash from current ledger state
        // This combines ledger sequence, timestamp, and token_id for uniqueness
        // Note: In production, you might want to pass the actual transaction hash as a parameter
        // For now, we create a deterministic hash from available ledger data
        let ledger_seq = env.ledger().sequence();

        // Create hash input from components as a byte array
        // We'll manually construct bytes from token_id, timestamp, and ledger_seq
        let mut hash_bytes = [0u8; 20];
        hash_bytes[0..4].copy_from_slice(&token_id.to_be_bytes());
        hash_bytes[4..12].copy_from_slice(&timestamp.to_be_bytes());
        hash_bytes[12..20].copy_from_slice(&ledger_seq.to_be_bytes());

        let hash_input = Bytes::from_array(&env, &hash_bytes);
        let hash = env.crypto().sha256(&hash_input);
        let tx_hash = BytesN::from_array(&env, &hash.to_array());

        // Call burn on CarbonAsset contract
        // The contract must be pre-authorized as a burner on the CarbonAsset contract
        // We assume CarbonAsset has a burn function that accepts (token_id: u32, from: Address)
        // The CarbonAsset contract should verify ownership before allowing burn
        let burn_symbol = Symbol::new(&env, "burn");
        let mut burn_args = Vec::new(&env);
        burn_args.push_back(token_id.into_val(&env));
        burn_args.push_back(retiring_entity.clone().into_val(&env));
        env.invoke_contract::<()>(&carbon_asset_contract, &burn_symbol, burn_args);

        // Create retirement record
        let record = RetirementRecord {
            token_id,
            retiring_entity: retiring_entity.clone(),
            timestamp,
            tx_hash: tx_hash.clone(),
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
            if let Ok(record) = Self::retire(
                env.clone(),
                token_id,
                retiring_entity.clone(),
                reason.clone(),
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
}
