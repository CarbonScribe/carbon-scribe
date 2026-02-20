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
}
