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
    /// Version number for this rule's content, starting at 1. Set by the
    /// contract itself: any value supplied here by a caller of `add_rule` or
    /// `update_rule` is ignored and overwritten — `add_rule` always assigns
    /// 1, and `update_rule` always assigns `previous_version + 1`. Used to
    /// key `DataKey::RuleHistory` entries and returned by
    /// `get_rule_history`/`get_rule_at_version` for audit/legal traceability.
    pub version: u32,
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
    /// An archived, superseded `JurisdictionRule`, keyed by (rule_id,
    /// version). Written by `update_rule` (for the version it replaces) and
    /// by `deactivate_rule` (for the final live version, since deactivation
    /// no longer erases rule content). Never removed, so it survives
    /// deactivation for audit/legal traceability.
    RuleHistory(String, u32),
    /// The latest version number ever assigned to a rule_id. Persists after
    /// `deactivate_rule` (unlike `Rule(rule_id)`, which is removed) so
    /// `get_rule_history`/`get_rule_at_version` keep working for a
    /// deactivated rule.
    RuleVersion(String),
}
