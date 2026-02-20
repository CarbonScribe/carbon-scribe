use soroban_sdk::{contractevent, Env, String};

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
