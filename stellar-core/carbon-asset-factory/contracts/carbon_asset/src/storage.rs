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
    // Buffer pool contract address for automatic reserve deposits on mint
    // (issue #684). Optional, like RegulatoryCheck: unset means this
    // deployment hasn't opted into the integration, and mint() behaves
    // exactly as it did before #684 — no call, no event.
    BufferPool,
}
