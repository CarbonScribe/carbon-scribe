use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Unauthorized = 1,
    InvalidTokenId = 2,
    InvalidPercentage = 3,
    InsufficientBalance = 4,
    TokenNotFound = 5,
    AlreadyExists = 6,
    InvalidState = 7,
}
