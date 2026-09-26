use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    AdminNotFound = 2,
    ProjectNotFound = 3,
    ProjectAlreadyExists = 4,
    NoDocumentsFound = 5,
    InvalidCidFormat = 6,
    EmptyBatch = 7,
    NoProjectsFound = 8,
    TimestampNotMonotonic = 9,
    CompactionInProgress = 10,
    InvalidCompactionConfig = 11,
    InvalidAddress = 12,
    SameOwner = 13,
    PendingTransferExists = 14,
    NoPendingTransfer = 15,
    NotPendingOwner = 16,
}
