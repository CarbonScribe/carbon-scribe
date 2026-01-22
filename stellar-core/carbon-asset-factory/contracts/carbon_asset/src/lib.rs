#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, Map, Symbol,
    Val, Vec,
};

// ============================================================================
// Data Types
// ============================================================================

/// Token status lifecycle states
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TokenStatus {
    Issued = 0,      // Initial state after minting
    Listed = 1,      // Available for purchase on marketplace
    Locked = 2,      // Temporarily locked (e.g., pending verification)
    Retired = 3,     // Permanently retired, non-transferable
    Invalidated = 4, // Invalidated due to reversal or fraud, non-transferable
}

/// Carbon asset metadata - immutable core data
#[contracttype]
#[derive(Clone, Debug)]
pub struct CarbonAssetMetadata {
    /// Unique project identifier
    pub project_id: BytesN<32>,
    /// Vintage year as timestamp (Unix epoch)
    pub vintage_year: u64,
    /// Methodology NFT contract address (links to on-chain methodology)
    pub methodology_id: Address,
    /// Hash of geolocation/geometries data
    pub geolocation_hash: BytesN<32>,
}

/// Per-token storage structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct TokenData {
    /// Immutable metadata
    pub metadata: CarbonAssetMetadata,
    /// Current status of the token
    pub status: TokenStatus,
    /// Quality score for dynamic value adjustment (future oracle integration)
    pub quality_score: i128,
}

/// Composite key for balance storage (address + token_id)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BalanceKey {
    pub address: Address,
    pub token_id: u128,
}

// ============================================================================
// Storage Keys
// ============================================================================

const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const RETIREMENT_TRACKER_KEY: Symbol = symbol_short!("RET_TRACK");
const REGULATORY_CHECK_KEY: Symbol = symbol_short!("REG_CHECK");
const TOKEN_DATA_KEY: Symbol = symbol_short!("TOKEN_DATA");
const BALANCE_KEY: Symbol = symbol_short!("BALANCE");
const DECIMALS_KEY: Symbol = symbol_short!("DECIMALS");
const NAME_KEY: Symbol = symbol_short!("NAME");
const SYMBOL_KEY: Symbol = symbol_short!("SYMBOL");

// ============================================================================
// Contract Implementation
// ============================================================================

#[contract]
pub struct CarbonAsset;

#[contractimpl]
impl CarbonAsset {
    /// Initialize the contract
    /// 
    /// # Arguments
    /// * `admin` - The CarbonScribe treasury address (only address that can mint)
    /// * `retirement_tracker` - Address of the RetirementTracker contract (only address that can burn)
    /// * `name` - Token name
    /// * `symbol` - Token symbol
    /// * `decimals` - Token decimals (typically 7 for Stellar)
    pub fn initialize(
        env: Env,
        admin: Address,
        retirement_tracker: Address,
        name: Symbol,
        symbol: Symbol,
        decimals: u32,
    ) {
        // Ensure contract is not already initialized
        if env.storage().instance().has(&ADMIN_KEY) {
            panic!("Contract already initialized");
        }

        // Store admin and retirement tracker addresses
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&RETIREMENT_TRACKER_KEY, &retirement_tracker);
        env.storage().instance().set(&NAME_KEY, &name);
        env.storage().instance().set(&SYMBOL_KEY, &symbol);
        env.storage().instance().set(&DECIMALS_KEY, &decimals);

        // Initialize token data map
        let token_data: Map<u128, TokenData> = Map::new(&env);
        env.storage().instance().set(&TOKEN_DATA_KEY, &token_data);

        // Balances are stored per (address, token_id) pair using persistent storage
        // No need to initialize a map here as we'll use direct key-value storage
    }

    /// Set the regulatory check contract address (optional)
    /// 
    /// # Arguments
    /// * `regulatory_check` - Address of the RegulatoryCheck contract
    pub fn set_regulatory_check(env: Env, regulatory_check: Address) {
        // Only admin can set regulatory check
        Self::require_admin(&env);
        env.storage().instance().set(&REGULATORY_CHECK_KEY, &regulatory_check);
    }

    /// Mint new carbon credits (admin-only)
    /// 
    /// # Arguments
    /// * `to` - Address to mint tokens to
    /// * `amount` - Amount of tokens to mint
    /// * `token_id` - Unique token identifier
    /// * `metadata` - Carbon asset metadata
    pub fn mint(
        env: Env,
        to: Address,
        amount: i128,
        token_id: u128,
        metadata: CarbonAssetMetadata,
    ) {
        // Only admin can mint
        Self::require_admin(&env);

        // Validate amount
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Check if token_id already exists
        let mut token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        if token_data_map.contains_key(token_id) {
            panic!("Token ID already exists");
        }

        // Create token data with ISSUED status
        let token_data = TokenData {
            metadata: metadata.clone(),
            status: TokenStatus::Issued,
            quality_score: 100i128, // Default quality score (100 = 100%)
        };

        // Store token data
        token_data_map.set(token_id, token_data);
        env.storage().instance().set(&TOKEN_DATA_KEY, &token_data_map);

        // Update balance (per address and token_id)
        let balance_key = BalanceKey {
            address: to.clone(),
            token_id,
        };
        let current_balance = env
            .storage()
            .persistent()
            .get::<BalanceKey, i128>(&balance_key)
            .unwrap_or(0i128);
        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance + amount));

        // Emit mint event
        env.events().publish(
            (symbol_short!("mint"), symbol_short!("token_id")),
            (token_id, to.clone(), amount, metadata),
        );
    }

    /// Transfer tokens with status checks and regulatory compliance
    /// 
    /// # Arguments
    /// * `from` - Source address
    /// * `to` - Destination address
    /// * `amount` - Amount to transfer
    /// * `token_id` - Token identifier (for status checking)
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        token_id: u128,
    ) {
        // Validate amount
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Check authorization (from must be the caller or authorized)
        from.require_auth();

        // Get token data to check status
        let token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        let token_data = token_data_map
            .get(token_id)
            .unwrap_or_else(|| panic!("Token ID not found"));

        // Check if token is transferable
        match token_data.status {
            TokenStatus::Issued | TokenStatus::Listed => {
                // Allow transfer
            }
            TokenStatus::Retired | TokenStatus::Invalidated => {
                panic!("Token is frozen and cannot be transferred");
            }
            TokenStatus::Locked => {
                panic!("Token is locked and cannot be transferred");
            }
        }

        // Regulatory check hook (if configured)
        if env.storage().instance().has(&REGULATORY_CHECK_KEY) {
            let regulatory_check: Address =
                env.storage().instance().get(&REGULATORY_CHECK_KEY).unwrap();
            Self::call_regulatory_check(&env, &regulatory_check, &from, &to, &amount);
        }

        // Check balance (per address and token_id)
        let from_balance_key = BalanceKey {
            address: from.clone(),
            token_id,
        };
        let from_balance = env
            .storage()
            .persistent()
            .get::<BalanceKey, i128>(&from_balance_key)
            .unwrap_or(0i128);
        if from_balance < amount {
            panic!("Insufficient balance");
        }

        // Update balances
        env.storage()
            .persistent()
            .set(&from_balance_key, &(from_balance - amount));
        let to_balance_key = BalanceKey {
            address: to.clone(),
            token_id,
        };
        let to_balance = env
            .storage()
            .persistent()
            .get::<BalanceKey, i128>(&to_balance_key)
            .unwrap_or(0i128);
        env.storage()
            .persistent()
            .set(&to_balance_key, &(to_balance + amount));

        // Check if transfer is to retirement tracker (auto-retire)
        let retirement_tracker: Address =
            env.storage().instance().get(&RETIREMENT_TRACKER_KEY).unwrap();
        if to == retirement_tracker {
            Self::update_token_status(&env, token_id, TokenStatus::Retired);
        }

        // Emit transfer event
        env.events().publish(
            (symbol_short!("transfer"), symbol_short!("from"), symbol_short!("to")),
            (from, to, amount, token_id),
        );
    }

    /// Burn tokens (retirement tracker only)
    /// 
    /// # Arguments
    /// * `from` - Address to burn from
    /// * `amount` - Amount to burn
    /// * `token_id` - Token identifier
    pub fn burn(env: Env, from: Address, amount: i128, token_id: u128) {
        // Only retirement tracker can burn
        Self::require_retirement_tracker(&env);

        // Validate amount
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Check balance (per address and token_id)
        let from_balance_key = BalanceKey {
            address: from.clone(),
            token_id,
        };
        let from_balance = env
            .storage()
            .persistent()
            .get::<BalanceKey, i128>(&from_balance_key)
            .unwrap_or(0i128);
        if from_balance < amount {
            panic!("Insufficient balance");
        }

        // Update balance
        env.storage()
            .persistent()
            .set(&from_balance_key, &(from_balance - amount));

        // Get token data for event
        let token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        let token_data = token_data_map.get(token_id).unwrap();

        // Emit burn event
        env.events().publish(
            (symbol_short!("burn"), symbol_short!("from"), symbol_short!("token_id")),
            (from, amount, token_id, token_data.metadata),
        );
    }

    /// Update token status (admin-only for manual status changes)
    /// 
    /// # Arguments
    /// * `token_id` - Token identifier
    /// * `status` - New status
    pub fn update_status(env: Env, token_id: u128, status: TokenStatus) {
        // Only admin can update status
        Self::require_admin(&env);

        let mut token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        let mut token_data = token_data_map
            .get(token_id)
            .unwrap_or_else(|| panic!("Token ID not found"));

        let old_status = token_data.status;
        token_data.status = status;
        token_data_map.set(token_id, token_data);
        env.storage().instance().set(&TOKEN_DATA_KEY, &token_data_map);

        // Emit status change event
        env.events().publish(
            (symbol_short!("status_change"), symbol_short!("token_id")),
            (token_id, old_status, status),
        );
    }

    /// Update quality score (for future oracle integration)
    /// 
    /// # Arguments
    /// * `token_id` - Token identifier
    /// * `quality_score` - New quality score (typically 0-100, but can be any i128)
    pub fn update_quality_score(env: Env, token_id: u128, quality_score: i128) {
        // Only admin or authorized oracle can update quality score
        // For now, only admin. In future, this can be restricted to oracle address
        Self::require_admin(&env);

        let mut token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        let mut token_data = token_data_map
            .get(token_id)
            .unwrap_or_else(|| panic!("Token ID not found"));

        token_data.quality_score = quality_score;
        token_data_map.set(token_id, token_data);
        env.storage().instance().set(&TOKEN_DATA_KEY, &token_data_map);

        // Emit quality score update event
        env.events().publish(
            (symbol_short!("quality_update"), symbol_short!("token_id")),
            (token_id, quality_score),
        );
    }

    // ========================================================================
    // Getter Functions
    // ========================================================================

    /// Get token balance for an address and token_id
    pub fn balance(env: Env, address: Address, token_id: u128) -> i128 {
        let balance_key = BalanceKey { address, token_id };
        env.storage()
            .persistent()
            .get::<BalanceKey, i128>(&balance_key)
            .unwrap_or(0i128)
    }

    /// Get token data (metadata, status, quality score)
    pub fn get_token_data(env: Env, token_id: u128) -> Option<TokenData> {
        let token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        token_data_map.get(token_id)
    }

    /// Get token status
    pub fn get_status(env: Env, token_id: u128) -> Option<TokenStatus> {
        Self::get_token_data(env, token_id).map(|data| data.status)
    }

    /// Get token metadata
    pub fn get_metadata(env: Env, token_id: u128) -> Option<CarbonAssetMetadata> {
        Self::get_token_data(env, token_id).map(|data| data.metadata)
    }

    /// Get quality score
    pub fn get_quality_score(env: Env, token_id: u128) -> Option<i128> {
        Self::get_token_data(env, token_id).map(|data| data.quality_score)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&ADMIN_KEY).unwrap()
    }

    /// Get retirement tracker address
    pub fn retirement_tracker(env: Env) -> Address {
        env.storage().instance().get(&RETIREMENT_TRACKER_KEY).unwrap()
    }

    /// Get token name
    pub fn name(env: Env) -> Symbol {
        env.storage().instance().get(&NAME_KEY).unwrap()
    }

    /// Get token symbol
    pub fn symbol(env: Env) -> Symbol {
        env.storage().instance().get(&SYMBOL_KEY).unwrap()
    }

    /// Get token decimals
    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DECIMALS_KEY).unwrap()
    }

    // ========================================================================
    // Internal Helper Functions
    // ========================================================================

    /// Require that the caller is the admin
    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();
    }

    /// Require that the caller is the retirement tracker
    fn require_retirement_tracker(env: &Env) {
        let retirement_tracker: Address =
            env.storage().instance().get(&RETIREMENT_TRACKER_KEY).unwrap();
        retirement_tracker.require_auth();
    }

    /// Update token status (internal helper)
    fn update_token_status(env: &Env, token_id: u128, status: TokenStatus) {
        let mut token_data_map: Map<u128, TokenData> =
            env.storage().instance().get(&TOKEN_DATA_KEY).unwrap();
        let mut token_data = token_data_map
            .get(token_id)
            .unwrap_or_else(|| panic!("Token ID not found"));

        let old_status = token_data.status;
        token_data.status = status;
        token_data_map.set(token_id, token_data);
        env.storage().instance().set(&TOKEN_DATA_KEY, &token_data_map);

        // Emit status change event
        env.events().publish(
            (symbol_short!("status_change"), symbol_short!("token_id")),
            (token_id, old_status, status),
        );
    }

    /// Call regulatory check contract (if configured)
    fn call_regulatory_check(
        env: &Env,
        regulatory_check: &Address,
        from: &Address,
        to: &Address,
        amount: &i128,
    ) {
        // Create a client to call the regulatory check contract
        // This assumes the regulatory check contract has a function like:
        // `check_transfer(from: Address, to: Address, amount: i128) -> bool`
        // The exact interface will depend on the RegulatoryCheck contract implementation
        
        // For now, we'll use invoke_contract to call the regulatory check
        // The regulatory check contract should implement a standard interface
        let result: Val = env
            .invoke_contract(
                regulatory_check,
                &symbol_short!("check_transfer"),
                &vec![
                    env,
                    from.to_val(),
                    to.to_val(),
                    amount.to_val(),
                ],
            )
            .unwrap();

        // If the result is false or an error, reject the transfer
        // This is a simplified check - the actual implementation may vary
        if let Ok(approved) = result.try_into_val::<bool>(env) {
            if !approved {
                panic!("Transfer rejected by regulatory check");
            }
        } else {
            // If the contract doesn't return a bool, we assume it panics on rejection
            // This allows for different regulatory check contract implementations
        }
    }
}
