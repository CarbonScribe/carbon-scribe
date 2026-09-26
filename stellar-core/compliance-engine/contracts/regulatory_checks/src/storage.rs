use soroban_sdk::{contracttype, Address, BytesN, String};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum OperationType {
    TRANSFER,
    RETIREMENT,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct JurisdictionRule {
    pub rule_id: String,
    pub description: String,
    pub source_jur: String,
    pub dest_jur: String,
    pub host_jur: String,
    pub operation: OperationType,
    pub is_allowed: bool,
    pub required_authority: Option<Address>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ValidationResult {
    pub is_compliant: bool,
    pub rule_id: Option<String>,
    pub requires_authorization: bool,
    pub authority_address: Option<Address>,
    pub error_message: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PendingApproval {
    pub token_id: u32,
    pub source: Address,
    pub destination: Address,
    pub operation: OperationType,
    pub timestamp: u64,
    pub approved: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governance,
    CarbonAssetContract,
    Rule(String),
    ActiveRuleIds,
    AddressJurisdiction(Address),
    PendingApproval(BytesN<32>),
}
