use soroban_sdk::{contractevent, Address, Env, String};

/// Event emitted when old events are pruned from the audit trail.
///
/// Published by `prune_old_events()` when at least one event is removed.
#[contractevent]
pub struct PruningEvent {
    pub pruned_count: u32,
    pub pruned_bytes: u64,
    pub timestamp: u64,
}

/// Event emitted when a caller attempts to record an event but is **not** in
/// the authorized-emitters list.
///
/// Recording this event (rather than silently panicking) ensures the audit
/// trail itself contains a tamper-evident record of every access-control
/// violation, enabling security reviews and alerting pipelines.
///
/// Because provenance validation failures happen *before* any state is written,
/// this event is emitted on the environment's event stream and the call still
/// panics afterwards so no state is persisted.
#[contractevent]
pub struct ProvenanceValidationFailed {
    /// The actual contract/account that invoked the audit trail — i.e., the
    /// address returned by `env.invoker()`.
    pub caller: Address,
    /// The event type the caller attempted to record.
    pub attempted_event_type: String,
    /// Ledger timestamp at which the violation was detected.
    pub timestamp: u64,
}

/// Emit a [`PruningEvent`].
pub fn emit_pruning_event(env: &Env, pruned_count: u32, pruned_bytes: u64) {
    PruningEvent {
        pruned_count,
        pruned_bytes,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

/// Emit a [`ProvenanceValidationFailed`] event.
///
/// Call this *before* panicking so that the event is flushed to the
/// transaction's event stream even though the invocation reverts.
pub fn emit_provenance_validation_failed(env: &Env, caller: Address, attempted_event_type: String) {
    ProvenanceValidationFailed {
        caller,
        attempted_event_type,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}
