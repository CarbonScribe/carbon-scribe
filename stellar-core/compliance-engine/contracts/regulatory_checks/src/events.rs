use crate::{OperationType, JurisdictionRule};
use soroban_sdk::{contractevent, Address, Bytes, Env, String};

/// A deterministic hash of a JurisdictionRule used for change detection.
/// Computed by concatenating all rule fields into a canonical byte representation.
pub fn compute_rule_hash(env: &Env, rule: &JurisdictionRule) -> Bytes {
    let mut bytes = Bytes::new(env);

    // Append each field
    append_string(env, &mut bytes, &rule.rule_id);
    append_string(env, &mut bytes, &rule.description);
    append_string(env, &mut bytes, &rule.source_jur);
    append_string(env, &mut bytes, &rule.dest_jur);
    append_string(env, &mut bytes, &rule.host_jur);

    // Append operation discriminant
    let op_discriminant: u32 = match rule.operation {
        OperationType::TRANSFER => 0,
        OperationType::RETIREMENT => 1,
    };
    let op_bytes = Bytes::from_array(env, &op_discriminant.to_be_bytes());
    bytes.append(&op_bytes);

    // Append is_allowed
    let allowed_byte: u8 = if rule.is_allowed { 1 } else { 0 };
    bytes.push_back(allowed_byte);

    // Append required_authority if present — use a marker byte plus clone marker
    if rule.required_authority.is_some() {
        bytes.push_back(1u8);
    } else {
        bytes.push_back(0u8);
    }

    bytes
}

fn append_string(env: &Env, bytes: &mut Bytes, s: &String) {
    let str_bytes = s.to_bytes();
    // Append length prefix
    let len = str_bytes.len() as u32;
    let len_bytes = Bytes::from_array(env, &len.to_be_bytes());
    bytes.append(&len_bytes);
    // Append content
    bytes.append(&str_bytes);
    // Null terminator
    bytes.push_back(0u8);
}

/// Event emitted when a new regulatory rule is added
#[contractevent]
pub struct RuleAdded {
    pub rule_id: String,
    pub source_jur: String,
    pub dest_jur: String,
    pub host_jur: String,
    pub operation: OperationType,
    pub is_allowed: bool,
    pub required_authority: Option<Address>,
    pub added_by: Address,
    pub timestamp: u64,
}

/// Event emitted when an existing rule is updated
#[contractevent]
pub struct RuleUpdated {
    pub rule_id: String,
    pub old_rule_hash: Bytes,
    pub new_rule_hash: Bytes,
    pub updated_by: Address,
    pub timestamp: u64,
}

/// Event emitted when a rule is deactivated
#[contractevent]
pub struct RuleDeactivated {
    pub rule_id: String,
    pub deactivated_by: Address,
    pub timestamp: u64,
}

/// Emit a RuleAdded event
pub fn emit_rule_added_event(
    env: &Env,
    rule_id: String,
    source_jur: String,
    dest_jur: String,
    host_jur: String,
    operation: OperationType,
    is_allowed: bool,
    required_authority: Option<Address>,
    added_by: Address,
) {
    RuleAdded {
        rule_id,
        source_jur,
        dest_jur,
        host_jur,
        operation,
        is_allowed,
        required_authority,
        added_by,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

/// Emit a RuleUpdated event
pub fn emit_rule_updated_event(
    env: &Env,
    rule_id: String,
    old_rule_hash: Bytes,
    new_rule_hash: Bytes,
    updated_by: Address,
) {
    RuleUpdated {
        rule_id,
        old_rule_hash,
        new_rule_hash,
        updated_by,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

/// Emit a RuleDeactivated event
pub fn emit_rule_deactivated_event(
    env: &Env,
    rule_id: String,
    deactivated_by: Address,
) {
    RuleDeactivated {
        rule_id,
        deactivated_by,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}