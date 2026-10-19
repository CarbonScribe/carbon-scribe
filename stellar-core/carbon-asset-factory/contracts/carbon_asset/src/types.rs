use soroban_sdk::{contracttype, Address, BytesN, Env, String};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum AssetStatus {
    Issued,
    Listed,
    Locked,
    Retired,
    Invalidated,
}

#[derive(Clone)]
#[contracttype]
pub struct CarbonAssetMetadata {
    pub project_id: String,
    pub vintage_year: u64,
    pub methodology_id: u32,
    pub geo_hash: BytesN<32>,
    /// Optional per-asset max supply cap. If set, this asset type cannot be
    /// minted beyond this count. Uses the contract-level MaxSupply when None.
    pub max_supply: Option<u32>,
}

// Shared with RegulatoryCheck contract for validation.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum OperationType {
    TRANSFER,
    RETIREMENT,
}

#[derive(Clone)]
#[contracttype]
pub struct ValidationResult {
    pub is_compliant: bool,
    pub rule_id: Option<String>,
    pub requires_authorization: bool,
    pub authority_address: Option<Address>,
    pub error_message: Option<String>,
}

#[derive(Clone)]
#[contracttype]
pub struct AllowanceData {
    pub amount: i128,
    pub live_until_ledger: u32,
}

/// Outcome of an attempted buffer_pool::auto_deposit call during mint()
/// (issue #684). Recorded on carbon_asset's own AutoDepositEvent so the
/// result is auditable here independent of whatever buffer_pool's own
/// event emitted — or didn't, if the call never reached it at all.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum AutoDepositOutcome {
    /// auto_deposit was called and the buffer pool recorded a new
    /// CustodyRecord for this token.
    Deposited,
    /// auto_deposit was called and returned Ok(false): this token_id
    /// wasn't due for sampling under the configured replenishment
    /// percentage, or a record already existed for it.
    NotSampled,
    /// auto_deposit was called but the call itself failed — the pool is
    /// paused, the configured address doesn't match buffer_pool's own
    /// carbon_asset_contract setting, or any other trap/error. Fail-open
    /// by design (see mint()'s doc comment): the mint is NOT rolled back.
    CallFailed,
}

#[allow(dead_code)]
pub trait CarbonAssetValueOracle {
    fn update_quality_score(
        env: Env,
        caller: Address,
        token_id: u32,
        new_score: i128,
    ) -> Result<(), super::errors::ContractError>;
}
