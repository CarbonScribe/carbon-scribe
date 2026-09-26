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
    /// Evaluation precedence. **Lower values win**: a rule with priority 10 is
    /// evaluated before — and therefore governs ahead of — one with priority
    /// 20. This lets a narrow, specific rule override a broad catch-all
    /// regardless of the order the two were added.
    ///
    /// Rules sharing a priority are ordered by `rule_id` ascending, so the
    /// outcome never depends on storage insertion order. Priority 0 is the
    /// highest precedence and is the value existing rules take when they are
    /// migrated, preserving a single well-defined ordering for them.
    pub priority: u32,
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
