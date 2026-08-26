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
}
