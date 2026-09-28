use soroban_sdk::{contractevent, Address, Env, String};

#[contractevent]
pub struct Initialized {
    pub admin: Address,
    pub timestamp: u64,
}

#[contractevent]
pub struct ReinitializationAttempted {
    pub attempted_by: Address,
    pub timestamp: u64,
}

/// Emitted when a tax attribute tag is detached from a token, so off-chain
/// auditors and dependent contracts (e.g. carbon_asset, regulatory_checks)
/// have a signal to react to instead of having to poll and diff
/// `get_attributes_for_token`.
#[contractevent]
pub struct AttributeRevokedEvent {
    pub token_id: u32,
    pub tag_id: String,
    pub revoked_by: Address,
    pub reason: String,
    pub timestamp: u64,
}

pub fn emit_initialized_event(env: &Env, admin: Address) {
    Initialized {
        admin,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

pub fn emit_reinitialization_attempted_event(env: &Env, attempted_by: Address) {
    ReinitializationAttempted {
        attempted_by,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

pub fn emit_attribute_revoked_event(
    env: &Env,
    token_id: u32,
    tag_id: String,
    revoked_by: Address,
    reason: String,
) {
    AttributeRevokedEvent {
        token_id,
        tag_id,
        revoked_by,
        reason,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}
