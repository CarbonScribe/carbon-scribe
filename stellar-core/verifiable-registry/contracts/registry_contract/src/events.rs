use soroban_sdk::{contractevent, Address, Env, String};

/// Structured event emitted when a document is anchored
/// This enables off-chain indexing and real-time updates to Layer 3 portals
#[contractevent]
pub struct DocumentAnchored {
    pub project_id: String,
    pub ipfs_cid: String,
    pub document_type: String,
    pub version_index: u32,
    pub timestamp: u64,
}

/// Event emitted after an anchorer index compaction is performed
#[contractevent]
pub struct AnchorerIndexCompacted {
    /// The anchorer whose index was compacted
    pub anchorer: Address,
    /// Number of duplicate entries removed
    pub duplicates_removed: u32,
    /// Number of stale/inactive projects pruned
    pub pruned_projects: u32,
    /// Total remaining projects after compaction
    pub remaining_projects: u32,
    /// Ledger timestamp when compaction was triggered
    pub timestamp: u64,
}

/// Emit a structured event when a document is anchored
pub fn emit_document_anchored_event(
    env: &Env,
    project_id: String,
    ipfs_cid: String,
    document_type: String,
    version_index: u32,
) {
    DocumentAnchored {
        project_id,
        ipfs_cid,
        document_type,
        version_index,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

/// Emit a structured event when anchorer index compaction completes
pub fn emit_anchorer_index_compacted_event(
    env: &Env,
    anchorer: Address,
    duplicates_removed: u32,
    pruned_projects: u32,
    remaining_projects: u32,
) {
    AnchorerIndexCompacted {
        anchorer,
        duplicates_removed,
        pruned_projects,
        remaining_projects,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}