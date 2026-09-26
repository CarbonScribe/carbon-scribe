use soroban_sdk::{contracttype, Address, String, Vec};

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

/// Configuration for the anchorer index compaction strategy
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompactionConfig {
    /// Maximum number of projects in the anchorer index before auto-compaction triggers
    pub max_index_size: u32,
    /// Age threshold in seconds; projects with no documents anchored after this threshold
    /// (relative to current ledger timestamp) may be pruned during compaction
    pub pruning_age_seconds: u64,
    /// Whether automatic compaction on index writes is enabled
    pub auto_compaction_enabled: bool,
}

/// Paginated result for get_projects_by_anchorer queries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaginatedProjects {
    /// The list of project IDs for the current page
    pub projects: Vec<String>,
    /// Total number of unique projects across all pages
    pub total: u32,
    /// Cursor for the next page. If None, this is the last page.
    pub next_cursor: Option<u32>,
}

pub use crate::errors::Error;