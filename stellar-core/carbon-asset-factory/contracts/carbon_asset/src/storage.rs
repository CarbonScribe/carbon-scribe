use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    // Holds a proposed successor admin address during a two-step transfer
    // (issue #557). Absent when no transfer is in flight.
    PendingAdmin,
    Name,
    Symbol,
    Decimals,
    NextTokenId,
    EventSequence,
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
    // Mint cap controls (issue #472)
    MaxSupply,
    TotalMinted,
    MintingFrozen,
}
