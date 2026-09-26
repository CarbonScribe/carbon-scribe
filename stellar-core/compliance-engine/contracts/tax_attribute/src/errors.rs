use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotAuthorized = 2,
    NotAuthorizedIssuer = 3,
    AttributeNotFound = 4,
    AttributeAlreadyExists = 5,
    AttributeExpired = 6,
    AttributeNotAttached = 7,
    InvalidToken = 8,
}
