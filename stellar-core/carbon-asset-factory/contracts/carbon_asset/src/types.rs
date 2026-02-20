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

#[allow(dead_code)]
pub trait CarbonAssetValueOracle {
    fn update_quality_score(
        env: Env,
        caller: Address,
        token_id: u32,
        new_score: i128,
    ) -> Result<(), super::errors::ContractError>;
}
