use soroban_sdk::{contracterror, contracttype, Address, String};

/// Document record structure storing metadata about an anchored document
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DocumentRecord {
    /// IPFS Content Identifier (e.g., "QmXYZ...")
    pub ipfs_cid: String,
    /// Ledger close timestamp when the document was anchored
    pub timestamp: u64,
    /// Type of document (e.g., "PDD", "MONITORING_REPORT", "VERIFICATION")
    pub document_type: String,
    /// Address that performed the anchoring
    pub anchorer: Address,
}

/// Contract error types
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Contract already initialized
    AlreadyInitialized = 1,
    /// Admin not found
    AdminNotFound = 2,
    /// Project not found
    ProjectNotFound = 3,
    /// Project already exists
    ProjectAlreadyExists = 4,
    /// No documents found for project
    NoDocumentsFound = 5,
    /// Invalid IPFS CID format
    InvalidCidFormat = 6,
    /// Empty batch provided
    EmptyBatch = 7,
    /// No projects found for anchorer
    NoProjectsFound = 8,
}
