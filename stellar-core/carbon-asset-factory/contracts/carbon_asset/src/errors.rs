use soroban_sdk::contracterror;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracterror]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    TokenNotFound = 4,
    NotOwner = 5,
    TransferNotAllowed = 6,
    StatusFrozen = 7,
    InvalidStatusTransition = 8,
    ComplianceFailed = 9,
    RegulatoryNotSet = 10,
    HostJurisdictionNotSet = 11,
    TokenAlreadyBurned = 12,
    // Mint cap errors (issue #472)
    SupplyLimitExceeded = 13,
    MintingIsFrozen = 14,
    MaxSupplyAlreadySet = 15,
    MaxSupplyBelowMinted = 16,
    // Two-step admin transfer errors (issue #557)
    NoPendingAdmin = 17,
    NotPendingAdmin = 18,
    // The call to the regulatory contract itself failed — it isn't
    // deployed, doesn't export validate_transaction, its return value
    // didn't deserialize as ValidationResult, or it returned its own
    // error. Distinct from ComplianceFailed, which means the call
    // succeeded and the regulatory contract responded non-compliant
    // (issue #517).
    ComplianceCallFailed = 19,
}
