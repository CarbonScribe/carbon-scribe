use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    NextTokenId,
    RetirementTracker,
    RegulatoryCheck,
    HostJurisdiction,
    Oracle,
    Owner(u32),
    OwnerTokens(Address),
    TokenIndex(u32),
    Allowance(Address, Address),
    Metadata(u32),
    Status(u32),
    QualityScore(u32),
    Burned(u32),
}
