use soroban_sdk::contracterror;

#[contracterror]
#[derive(Debug, Clone, Copy, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u32)]
pub enum ContractError {
    NotAuthorized = 1,
    RuleNotFound = 2,
    RuleAlreadyExists = 3,
    JurisdictionNotSet = 4,
    InvalidApprovalKey = 5,
    ApprovalExpired = 6,
    NoMatchingRule = 7,
    RuleConflict = 8,
    AlreadyInitialized = 9,
    /// A state-mutating entrypoint was called before initialize() (issue #519).
    NotInitialized = 10,
    InvalidRuleSchema = 11,
    /// A pending approval already exists under the derived key; approvals are
    /// never overwritten or reset (issue #819).
    ApprovalAlreadyExists = 12,
    /// An approval validity window of zero seconds was supplied.
    InvalidApprovalValidity = 13,
}
