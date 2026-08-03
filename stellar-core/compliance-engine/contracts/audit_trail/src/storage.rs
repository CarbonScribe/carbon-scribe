use soroban_sdk::{contracttype, Address, BytesN, String};

/// Storage keys for the audit trail contract.
///
/// Separating storage key definitions into this module keeps `lib.rs` focused
/// on business logic and makes it easy to reason about what lives in each
/// storage tier (instance vs. persistent).
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The contract administrator address (instance storage).
    Admin,
    /// Map of Address → bool indicating which contracts may record events
    /// (instance storage).
    AuthorizedEmitters,
    /// Individual audit event keyed by its unique 32-byte event ID (persistent
    /// storage).
    Events(BytesN<32>),
    /// Index from entity ID → list of event IDs (persistent storage).
    EntityIndex(String),
    /// Index from (event_type, day_timestamp) → list of event IDs (persistent
    /// storage).
    TypeTimeIndex((String, u64)),
    /// Index from emitting contract address → list of event IDs (persistent
    /// storage).
    ContractIndex(Address),
    /// Configurable retention period in seconds (instance storage).
    RetentionPeriod,
    /// Sorted list of day-aligned timestamps that have at least one event
    /// (instance storage, used by the pruner).
    ActiveDays,
    /// Index from day-aligned timestamp → list of event IDs recorded on that
    /// day (persistent storage, used by the pruner).
    AllEventsIndex(u64),
    /// Running count of stored events (instance storage).
    TotalEventCount,
    /// Running total of approximate event bytes (instance storage).
    TotalEventBytes,
}
