#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, log, Address, Bytes,
    BytesN, Env, String, Vec,
};

/// Storage keys for the contract's persistent data
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin address for configuration management
    Admin,
    /// Trusted relayer service address for root updates
    Updater,
    /// CarbonAsset contract address for minting wrapped tokens
    CarbonAssetContract,
    /// Current epoch counter
    CurrentEpoch,
    /// Merkle root for a specific epoch (epoch_id -> root_hash)
    MerkleRoot(u64),
    /// Whether a registry credit has been minted (registry_credit_id -> bool)
    MintedCredit(String),
    /// Whether a registry credit has been retired (registry_credit_id -> bool)
    RetiredCredit(String),
    /// Next token ID for minting
    NextTokenId,
}

/// Credit status enum for leaf node construction
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum CreditStatus {
    Available,
    Retired,
}

/// Event emitted when a credit is bridged
#[contractevent]
#[derive(Clone, Debug)]
pub struct CreditBridgedEvent {
    pub registry_credit_id: String,
    pub stellar_token_id: u32,
    pub bridged_by: Address,
    pub epoch_id: u64,
}

/// Event emitted when a new Merkle root is anchored
#[contractevent]
#[derive(Clone, Debug)]
pub struct RootUpdatedEvent {
    pub epoch_id: u64,
    pub root_hash: BytesN<32>,
    pub updated_by: Address,
}

/// Event emitted when a credit is marked as retired
#[contractevent]
#[derive(Clone, Debug)]
pub struct CreditRetiredEvent {
    pub registry_credit_id: String,
    pub retired_by: Address,
}

/// Contract error codes
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MerkleBridgeError {
    /// Contract has already been initialized
    AlreadyInitialized = 1,
    /// Contract has not been initialized yet
    NotInitialized = 2,
    /// Caller is not the admin
    NotAdmin = 3,
    /// Caller is not the updater
    NotUpdater = 4,
    /// Invalid epoch ID provided
    InvalidEpochId = 5,
    /// Merkle root not found for the given epoch
    RootNotFound = 6,
    /// Credit has already been minted
    AlreadyMinted = 7,
    /// Credit has been retired and cannot be minted
    CreditRetired = 8,
    /// Invalid Merkle proof
    InvalidProof = 9,
    /// Invalid proof length for the given tree depth
    InvalidProofLength = 10,
    /// CarbonAsset contract not set
    CarbonAssetNotSet = 11,
    /// Epoch must be sequential
    NonSequentialEpoch = 12,
}

// Note: CarbonAsset contract integration will be added once the CarbonAsset
// contract is implemented (Issue #1). The mint_wrapped function currently
// tracks token IDs internally and emits events for indexing.
//
// Future integration will include:
// ```rust
// mod carbon_asset {
//     soroban_sdk::contractimport!(
//         file = "../carbon_asset/target/wasm32-unknown-unknown/release/carbon_asset.wasm"
//     );
// }
// ```

/// The MerkleBridge contract for bridging carbon credits from external registries
#[contract]
pub struct MerkleBridge;

#[contractimpl]
impl MerkleBridge {
    /// Initialize the MerkleBridge contract
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `admin` - The admin address for configuration management
    /// * `updater` - The trusted relayer service address
    ///
    /// # Returns
    /// * `Result<(), MerkleBridgeError>` - Success or error
    pub fn initialize(
        env: Env,
        admin: Address,
        updater: Address,
    ) -> Result<(), MerkleBridgeError> {
        // Check if already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(MerkleBridgeError::AlreadyInitialized);
        }

        // Store configuration
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Updater, &updater);
        env.storage().instance().set(&DataKey::CurrentEpoch, &0u64);
        env.storage().instance().set(&DataKey::NextTokenId, &1u32);

        log!(&env, "MerkleBridge initialized with admin: {}", admin);

        Ok(())
    }

    /// Set the CarbonAsset contract address
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `caller` - The caller address (must be admin)
    /// * `carbon_asset_contract` - The CarbonAsset contract address
    ///
    /// # Returns
    /// * `Result<(), MerkleBridgeError>` - Success or error
    pub fn set_carbon_asset_contract(
        env: Env,
        caller: Address,
        carbon_asset_contract: Address,
    ) -> Result<(), MerkleBridgeError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;

        env.storage()
            .instance()
            .set(&DataKey::CarbonAssetContract, &carbon_asset_contract);

        log!(
            &env,
            "CarbonAsset contract set to: {}",
            carbon_asset_contract
        );

        Ok(())
    }

    /// Set a new updater address
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `caller` - The caller address (must be admin)
    /// * `new_updater` - The new updater address
    ///
    /// # Returns
    /// * `Result<(), MerkleBridgeError>` - Success or error
    pub fn set_updater(
        env: Env,
        caller: Address,
        new_updater: Address,
    ) -> Result<(), MerkleBridgeError> {
        caller.require_auth();
        Self::require_admin(&env, &caller)?;

        env.storage()
            .instance()
            .set(&DataKey::Updater, &new_updater);

        log!(&env, "Updater address changed to: {}", new_updater);

        Ok(())
    }

    /// Update the Merkle root for a new epoch
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `caller` - The caller address (must be updater)
    /// * `epoch_id` - The epoch identifier (must be sequential)
    /// * `root_hash` - The Merkle root hash
    ///
    /// # Returns
    /// * `Result<(), MerkleBridgeError>` - Success or error
    pub fn update_root(
        env: Env,
        caller: Address,
        epoch_id: u64,
        root_hash: BytesN<32>,
    ) -> Result<(), MerkleBridgeError> {
        caller.require_auth();
        Self::require_updater(&env, &caller)?;

        // Get current epoch and validate sequential increment
        let current_epoch: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentEpoch)
            .ok_or(MerkleBridgeError::NotInitialized)?;

        // Epoch must be exactly current + 1 to ensure sequential ordering
        if epoch_id != current_epoch + 1 {
            return Err(MerkleBridgeError::NonSequentialEpoch);
        }

        // Store the new root
        env.storage()
            .persistent()
            .set(&DataKey::MerkleRoot(epoch_id), &root_hash);

        // Update current epoch
        env.storage()
            .instance()
            .set(&DataKey::CurrentEpoch, &epoch_id);

        // Emit event
        RootUpdatedEvent {
            epoch_id,
            root_hash: root_hash.clone(),
            updated_by: caller.clone(),
        }
        .publish(&env);

        log!(
            &env,
            "Root updated for epoch {}: {:?}",
            epoch_id,
            root_hash
        );

        Ok(())
    }

    /// Mint a wrapped token by providing a valid Merkle proof
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `caller` - The caller address (any user with valid proof)
    /// * `registry_credit_id` - The unique identifier from the external registry
    /// * `merkle_proof` - The array of sibling hashes for verification
    /// * `leaf_index` - The position of the leaf in the Merkle tree
    /// * `epoch_id` - The epoch identifier for the Merkle root
    ///
    /// # Returns
    /// * `Result<u32, MerkleBridgeError>` - The minted token ID or error
    pub fn mint_wrapped(
        env: Env,
        caller: Address,
        registry_credit_id: String,
        merkle_proof: Vec<BytesN<32>>,
        leaf_index: u64,
        epoch_id: u64,
    ) -> Result<u32, MerkleBridgeError> {
        caller.require_auth();

        // Check if credit has already been minted
        if Self::is_credit_minted(&env, &registry_credit_id) {
            return Err(MerkleBridgeError::AlreadyMinted);
        }

        // Check if credit has been retired
        if Self::is_credit_retired(&env, &registry_credit_id) {
            return Err(MerkleBridgeError::CreditRetired);
        }

        // Get the stored Merkle root for the given epoch
        let stored_root: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::MerkleRoot(epoch_id))
            .ok_or(MerkleBridgeError::RootNotFound)?;

        // Validate proof length is consistent with leaf index
        Self::validate_proof_length(&merkle_proof, leaf_index)?;

        // Reconstruct the leaf node: sha256(registry_credit_id + "AVAILABLE")
        let leaf_hash = Self::compute_leaf_hash(&env, &registry_credit_id, CreditStatus::Available);

        // Verify the Merkle proof
        let computed_root = Self::verify_merkle_proof(&env, leaf_hash, &merkle_proof, leaf_index);

        // Compare computed root with stored root
        if computed_root != stored_root {
            return Err(MerkleBridgeError::InvalidProof);
        }

        // Mark credit as minted
        env.storage()
            .persistent()
            .set(&DataKey::MintedCredit(registry_credit_id.clone()), &true);

        // Get and increment token ID
        let token_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&DataKey::NextTokenId, &(token_id + 1));

        // Emit bridged event
        CreditBridgedEvent {
            registry_credit_id: registry_credit_id.clone(),
            stellar_token_id: token_id,
            bridged_by: caller.clone(),
            epoch_id,
        }
        .publish(&env);

        log!(
            &env,
            "Credit {} bridged as token {} by {}",
            registry_credit_id,
            token_id,
            caller
        );

        Ok(token_id)
    }

    /// Mark a registry credit as retired (prevents future minting)
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `caller` - The caller address (must be updater)
    /// * `registry_credit_id` - The registry credit ID to mark as retired
    ///
    /// # Returns
    /// * `Result<(), MerkleBridgeError>` - Success or error
    pub fn mark_retired(
        env: Env,
        caller: Address,
        registry_credit_id: String,
    ) -> Result<(), MerkleBridgeError> {
        caller.require_auth();
        Self::require_updater(&env, &caller)?;

        // Mark as retired
        env.storage()
            .persistent()
            .set(&DataKey::RetiredCredit(registry_credit_id.clone()), &true);

        // Emit event
        CreditRetiredEvent {
            registry_credit_id: registry_credit_id.clone(),
            retired_by: caller,
        }
        .publish(&env);

        log!(&env, "Credit {} marked as retired", registry_credit_id);

        Ok(())
    }

    // ============ View Functions ============

    /// Get the current epoch
    pub fn get_current_epoch(env: Env) -> Result<u64, MerkleBridgeError> {
        env.storage()
            .instance()
            .get(&DataKey::CurrentEpoch)
            .ok_or(MerkleBridgeError::NotInitialized)
    }

    /// Get the Merkle root for a specific epoch
    pub fn get_root(env: Env, epoch_id: u64) -> Result<BytesN<32>, MerkleBridgeError> {
        env.storage()
            .persistent()
            .get(&DataKey::MerkleRoot(epoch_id))
            .ok_or(MerkleBridgeError::RootNotFound)
    }

    /// Check if a credit has been minted
    pub fn is_minted(env: Env, registry_credit_id: String) -> bool {
        Self::is_credit_minted(&env, &registry_credit_id)
    }

    /// Check if a credit has been retired
    pub fn is_retired(env: Env, registry_credit_id: String) -> bool {
        Self::is_credit_retired(&env, &registry_credit_id)
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Result<Address, MerkleBridgeError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(MerkleBridgeError::NotInitialized)
    }

    /// Get the updater address
    pub fn get_updater(env: Env) -> Result<Address, MerkleBridgeError> {
        env.storage()
            .instance()
            .get(&DataKey::Updater)
            .ok_or(MerkleBridgeError::NotInitialized)
    }

    /// Get the CarbonAsset contract address
    pub fn get_carbon_asset_contract(env: Env) -> Result<Address, MerkleBridgeError> {
        env.storage()
            .instance()
            .get(&DataKey::CarbonAssetContract)
            .ok_or(MerkleBridgeError::CarbonAssetNotSet)
    }

    // ============ Internal Helper Functions ============

    /// Require the caller to be the admin
    fn require_admin(env: &Env, caller: &Address) -> Result<(), MerkleBridgeError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(MerkleBridgeError::NotInitialized)?;

        if caller != &admin {
            return Err(MerkleBridgeError::NotAdmin);
        }
        Ok(())
    }

    /// Require the caller to be the updater
    fn require_updater(env: &Env, caller: &Address) -> Result<(), MerkleBridgeError> {
        let updater: Address = env
            .storage()
            .instance()
            .get(&DataKey::Updater)
            .ok_or(MerkleBridgeError::NotInitialized)?;

        if caller != &updater {
            return Err(MerkleBridgeError::NotUpdater);
        }
        Ok(())
    }

    /// Check if a credit has been minted
    fn is_credit_minted(env: &Env, registry_credit_id: &String) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::MintedCredit(registry_credit_id.clone()))
            .unwrap_or(false)
    }

    /// Check if a credit has been retired
    fn is_credit_retired(env: &Env, registry_credit_id: &String) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::RetiredCredit(registry_credit_id.clone()))
            .unwrap_or(false)
    }

    /// Validate that the proof length is consistent with the leaf index
    fn validate_proof_length(
        proof: &Vec<BytesN<32>>,
        leaf_index: u64,
    ) -> Result<(), MerkleBridgeError> {
        let proof_len = proof.len() as u64;

        // For a tree with 2^n leaves, the proof length should be n
        // The leaf_index should be less than 2^proof_len
        if proof_len > 0 {
            let max_leaf_index = 1u64 << proof_len;
            if leaf_index >= max_leaf_index {
                return Err(MerkleBridgeError::InvalidProofLength);
            }
        } else if leaf_index > 0 {
            // If proof is empty, leaf_index must be 0 (single leaf tree)
            return Err(MerkleBridgeError::InvalidProofLength);
        }

        // Limit proof depth to 20 levels (supports trees up to ~1 million leaves)
        // This ensures the verification completes within Soroban's CPU limits
        if proof_len > 20 {
            return Err(MerkleBridgeError::InvalidProofLength);
        }

        Ok(())
    }

    /// Compute the leaf hash: sha256(registry_credit_id || status)
    fn compute_leaf_hash(env: &Env, registry_credit_id: &String, status: CreditStatus) -> BytesN<32> {
        // Convert registry_credit_id to bytes
        let mut data = Bytes::new(env);

        // Append registry credit ID bytes using copy_into_slice
        let id_len = registry_credit_id.len() as usize;
        let mut id_buffer = [0u8; 256]; // Max length buffer
        registry_credit_id.copy_into_slice(&mut id_buffer[..id_len]);
        for i in 0..id_len {
            data.push_back(id_buffer[i]);
        }

        // Append status bytes
        let status_str = match status {
            CreditStatus::Available => "AVAILABLE",
            CreditStatus::Retired => "RETIRED",
        };
        for byte in status_str.as_bytes() {
            data.push_back(*byte);
        }

        // Compute SHA-256 hash and convert to BytesN
        env.crypto().sha256(&data).into()
    }

    /// Verify a Merkle proof and return the computed root
    ///
    /// Uses lexicographic ordering for consistent hash combination
    fn verify_merkle_proof(
        env: &Env,
        leaf_hash: BytesN<32>,
        proof: &Vec<BytesN<32>>,
        _leaf_index: u64,
    ) -> BytesN<32> {
        let mut current_hash = leaf_hash;

        for i in 0..proof.len() {
            let sibling = proof.get(i).unwrap();

            // Combine hashes by sorting them lexicographically
            // This ensures consistent ordering regardless of position
            let combined = if Self::compare_hashes(&current_hash, &sibling) {
                // current_hash < sibling
                Self::concat_hashes(env, &current_hash, &sibling)
            } else {
                // sibling <= current_hash
                Self::concat_hashes(env, &sibling, &current_hash)
            };

            current_hash = env.crypto().sha256(&combined).into();
        }

        current_hash
    }

    /// Compare two hashes lexicographically
    /// Returns true if a < b
    fn compare_hashes(a: &BytesN<32>, b: &BytesN<32>) -> bool {
        for i in 0..32u32 {
            let a_byte = a.get(i).unwrap_or(0);
            let b_byte = b.get(i).unwrap_or(0);
            if a_byte < b_byte {
                return true;
            }
            if a_byte > b_byte {
                return false;
            }
        }
        false // Equal hashes
    }

    /// Concatenate two hashes
    fn concat_hashes(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> Bytes {
        let mut result = Bytes::new(env);

        // Append first hash
        for i in 0..32u32 {
            result.push_back(a.get(i).unwrap_or(0));
        }

        // Append second hash
        for i in 0..32u32 {
            result.push_back(b.get(i).unwrap_or(0));
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Bytes, Env};

    fn setup_env() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let updater = Address::generate(&env);
        (env, admin, updater)
    }

    fn create_contract(env: &Env) -> Address {
        env.register(MerkleBridge, ())
    }

    /// Helper to compute a leaf hash for testing
    fn compute_test_leaf_hash(env: &Env, registry_id: &str) -> BytesN<32> {
        let mut data = Bytes::new(env);
        for byte in registry_id.as_bytes() {
            data.push_back(*byte);
        }
        for byte in "AVAILABLE".as_bytes() {
            data.push_back(*byte);
        }
        env.crypto().sha256(&data).into()
    }

    /// Helper to compute the hash of two concatenated values (sorted lexicographically)
    fn hash_pair(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
        let mut data = Bytes::new(env);

        // Sort lexicographically
        let (first, second) = if MerkleBridge::compare_hashes(a, b) {
            (a, b)
        } else {
            (b, a)
        };

        for i in 0..32u32 {
            data.push_back(first.get(i).unwrap_or(0));
        }
        for i in 0..32u32 {
            data.push_back(second.get(i).unwrap_or(0));
        }
        env.crypto().sha256(&data).into()
    }

    #[test]
    fn test_initialize() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        // Initialize should succeed
        client.initialize(&admin, &updater);

        // Verify state
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_updater(), updater);
        assert_eq!(client.get_current_epoch(), 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_initialize_twice_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);
        client.initialize(&admin, &updater); // Should panic
    }

    #[test]
    fn test_set_updater() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let new_updater = Address::generate(&env);
        client.set_updater(&admin, &new_updater);

        assert_eq!(client.get_updater(), new_updater);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn test_set_updater_not_admin_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let not_admin = Address::generate(&env);
        let new_updater = Address::generate(&env);
        client.set_updater(&not_admin, &new_updater); // Should panic
    }

    #[test]
    fn test_update_root() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        // Create a mock root hash
        let root_hash = BytesN::from_array(&env, &[1u8; 32]);

        // Update root for epoch 1
        client.update_root(&updater, &1, &root_hash);

        assert_eq!(client.get_current_epoch(), 1);
        assert_eq!(client.get_root(&1), root_hash);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #12)")]
    fn test_update_root_non_sequential_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let root_hash = BytesN::from_array(&env, &[1u8; 32]);

        // Try to update root for epoch 5 (should be 1)
        client.update_root(&updater, &5, &root_hash); // Should panic
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn test_update_root_not_updater_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let not_updater = Address::generate(&env);
        let root_hash = BytesN::from_array(&env, &[1u8; 32]);

        client.update_root(&not_updater, &1, &root_hash); // Should panic
    }

    #[test]
    fn test_mint_wrapped_single_leaf() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        // Create a single-leaf Merkle tree
        let registry_id = String::from_str(&env, "VER-123-ABC-456");
        let leaf_hash = compute_test_leaf_hash(&env, "VER-123-ABC-456");

        // For a single leaf tree, the root is the leaf hash itself
        client.update_root(&updater, &1, &leaf_hash);

        // Mint with empty proof (single leaf)
        let user = Address::generate(&env);
        let proof: Vec<BytesN<32>> = Vec::new(&env);

        let token_id = client.mint_wrapped(&user, &registry_id, &proof, &0, &1);
        assert_eq!(token_id, 1);

        // Verify credit is marked as minted
        assert!(client.is_minted(&registry_id));
    }

    #[test]
    fn test_mint_wrapped_with_proof() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        // Create a 2-leaf Merkle tree
        let registry_id_1 = "VER-123-ABC-456";
        let registry_id_2 = "VER-789-DEF-012";

        let leaf_1 = compute_test_leaf_hash(&env, registry_id_1);
        let leaf_2 = compute_test_leaf_hash(&env, registry_id_2);

        // Compute root
        let root = hash_pair(&env, &leaf_1, &leaf_2);

        client.update_root(&updater, &1, &root);

        // Mint first credit with proof containing second leaf
        let user = Address::generate(&env);
        let mut proof: Vec<BytesN<32>> = Vec::new(&env);
        proof.push_back(leaf_2.clone());

        let registry_id = String::from_str(&env, registry_id_1);
        let token_id = client.mint_wrapped(&user, &registry_id, &proof, &0, &1);
        assert_eq!(token_id, 1);

        // Mint second credit
        let mut proof_2: Vec<BytesN<32>> = Vec::new(&env);
        proof_2.push_back(leaf_1.clone());

        let registry_id_2_str = String::from_str(&env, registry_id_2);
        let token_id_2 = client.mint_wrapped(&user, &registry_id_2_str, &proof_2, &1, &1);
        assert_eq!(token_id_2, 2);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #7)")]
    fn test_mint_wrapped_already_minted_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let registry_id = String::from_str(&env, "VER-123-ABC-456");
        let leaf_hash = compute_test_leaf_hash(&env, "VER-123-ABC-456");

        client.update_root(&updater, &1, &leaf_hash);

        let user = Address::generate(&env);
        let proof: Vec<BytesN<32>> = Vec::new(&env);

        // First mint succeeds
        client.mint_wrapped(&user, &registry_id, &proof, &0, &1);

        // Second mint fails
        client.mint_wrapped(&user, &registry_id, &proof, &0, &1); // Should panic
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #9)")]
    fn test_mint_wrapped_invalid_proof_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        // Create a leaf hash for a different credit
        let leaf_hash = compute_test_leaf_hash(&env, "VER-DIFFERENT-ID");
        client.update_root(&updater, &1, &leaf_hash);

        // Try to mint with wrong registry ID
        let user = Address::generate(&env);
        let registry_id = String::from_str(&env, "VER-123-ABC-456");
        let proof: Vec<BytesN<32>> = Vec::new(&env);

        client.mint_wrapped(&user, &registry_id, &proof, &0, &1); // Should panic
    }

    #[test]
    fn test_mark_retired() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let registry_id = String::from_str(&env, "VER-123-ABC-456");

        // Mark as retired
        client.mark_retired(&updater, &registry_id);

        assert!(client.is_retired(&registry_id));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #8)")]
    fn test_mint_retired_credit_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let registry_id = String::from_str(&env, "VER-123-ABC-456");
        let leaf_hash = compute_test_leaf_hash(&env, "VER-123-ABC-456");

        client.update_root(&updater, &1, &leaf_hash);

        // Mark as retired first
        client.mark_retired(&updater, &registry_id);

        // Try to mint
        let user = Address::generate(&env);
        let proof: Vec<BytesN<32>> = Vec::new(&env);

        client.mint_wrapped(&user, &registry_id, &proof, &0, &1); // Should panic
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn test_mint_wrapped_root_not_found_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let user = Address::generate(&env);
        let registry_id = String::from_str(&env, "VER-123-ABC-456");
        let proof: Vec<BytesN<32>> = Vec::new(&env);

        // No root has been set, should fail
        client.mint_wrapped(&user, &registry_id, &proof, &0, &1); // Should panic
    }

    #[test]
    fn test_set_carbon_asset_contract() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let carbon_asset_contract = Address::generate(&env);
        client.set_carbon_asset_contract(&admin, &carbon_asset_contract);

        assert_eq!(client.get_carbon_asset_contract(), carbon_asset_contract);
    }

    #[test]
    fn test_four_leaf_merkle_tree() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        // Create 4-leaf tree
        let ids = ["VER-001", "VER-002", "VER-003", "VER-004"];
        let leaves: [BytesN<32>; 4] = [
            compute_test_leaf_hash(&env, ids[0]),
            compute_test_leaf_hash(&env, ids[1]),
            compute_test_leaf_hash(&env, ids[2]),
            compute_test_leaf_hash(&env, ids[3]),
        ];

        // Level 1: hash pairs
        let node_01 = hash_pair(&env, &leaves[0], &leaves[1]);
        let node_23 = hash_pair(&env, &leaves[2], &leaves[3]);

        // Root
        let root = hash_pair(&env, &node_01, &node_23);

        client.update_root(&updater, &1, &root);

        // Mint VER-001 (index 0)
        // Proof: [leaf[1], node_23]
        let user = Address::generate(&env);
        let mut proof: Vec<BytesN<32>> = Vec::new(&env);
        proof.push_back(leaves[1].clone());
        proof.push_back(node_23.clone());

        let registry_id = String::from_str(&env, ids[0]);
        let token_id = client.mint_wrapped(&user, &registry_id, &proof, &0, &1);
        assert_eq!(token_id, 1);

        // Mint VER-003 (index 2)
        // Proof: [leaf[3], node_01]
        let mut proof_3: Vec<BytesN<32>> = Vec::new(&env);
        proof_3.push_back(leaves[3].clone());
        proof_3.push_back(node_01.clone());

        let registry_id_3 = String::from_str(&env, ids[2]);
        let token_id_3 = client.mint_wrapped(&user, &registry_id_3, &proof_3, &2, &1);
        assert_eq!(token_id_3, 2);
    }

    #[test]
    fn test_multiple_epochs() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        // Update roots for multiple epochs
        let root_1 = compute_test_leaf_hash(&env, "EPOCH1-VER-001");
        let root_2 = compute_test_leaf_hash(&env, "EPOCH2-VER-002");
        let root_3 = compute_test_leaf_hash(&env, "EPOCH3-VER-003");

        client.update_root(&updater, &1, &root_1);
        client.update_root(&updater, &2, &root_2);
        client.update_root(&updater, &3, &root_3);

        assert_eq!(client.get_current_epoch(), 3);
        assert_eq!(client.get_root(&1), root_1);
        assert_eq!(client.get_root(&2), root_2);
        assert_eq!(client.get_root(&3), root_3);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #10)")]
    fn test_invalid_proof_length_fails() {
        let (env, admin, updater) = setup_env();
        let contract_id = create_contract(&env);
        let client = MerkleBridgeClient::new(&env, &contract_id);

        client.initialize(&admin, &updater);

        let leaf_hash = compute_test_leaf_hash(&env, "VER-123");
        client.update_root(&updater, &1, &leaf_hash);

        // Try to mint with leaf_index too large for proof length
        let user = Address::generate(&env);
        let registry_id = String::from_str(&env, "VER-123");
        let proof: Vec<BytesN<32>> = Vec::new(&env);

        // leaf_index = 1 but proof is empty (only supports index 0)
        client.mint_wrapped(&user, &registry_id, &proof, &1, &1); // Should panic
    }
}
