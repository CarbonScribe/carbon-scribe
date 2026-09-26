use soroban_sdk::contracterror;

/// Errors defined for the Audit Trail contract (issue #520).
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AuditTrailError {
    /// initialize() was called more than once.
    AlreadyInitialized = 1,
    /// A state-mutating or storage-reading entrypoint was called before
    /// initialize().
    NotInitialized = 2,
    /// The caller is not on the authorized-emitters allowlist.
    EmitterNotAuthorized = 3,
    /// event_data exceeds MAX_EVENT_PAYLOAD_SIZE.
    PayloadTooLarge = 4,
}
