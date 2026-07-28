use soroban_sdk::contracterror;

/// Errors defined for the Retirement Tracker contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// The caller is not authorized to perform this operation.
    NotAuthorized = 1,
    /// The specified token is not owned by the caller.
    TokenNotOwned = 2,
    /// The token has already been retired.
    TokenAlreadyRetired = 3,
    /// The provided token ID is invalid.
    InvalidTokenId = 4,
    /// The token burn operation failed.
    BurnFailed = 5,
    /// The contract must be initialized.
    ContractNotInitialized = 6,
    /// The event nonce has overflowed.
    EventNonceOverflow = 7,
    /// The contract has already been initialized.
    AlreadyInitialized = 8,
}
