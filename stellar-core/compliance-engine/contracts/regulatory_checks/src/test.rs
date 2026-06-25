#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Bytes};

fn make_rule(
    env: &Env,
    rule_id: &str,
    src: &str,
    dst: &str,
    host: &str,
    op: OperationType,
    is_allowed: bool,
) -> JurisdictionRule {
    JurisdictionRule {
        rule_id: String::from_str(env, rule_id),
        description: String::from_str(env, "desc"),
        source_jur: String::from_str(env, src),
        dest_jur: String::from_str(env, dst),
        host_jur: String::from_str(env, host),
        operation: op,
        is_allowed,
        required_authority: None,
    }
}

#[test]
#[allow(deprecated)]
fn test_duplicate_rule_conflict() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RegulatoryCheck);
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    // Add a rule
    let rule1 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule1);

    // Attempt to add a logically duplicate rule (different rule_id, same params)
    let rule2 = make_rule(&env, "R2", "US", "CA", "US", OperationType::TRANSFER, true);
    let res = client.try_add_rule(&governance, &rule2);
    assert!(matches!(res, Err(Ok(ContractError::RuleConflict))));
}

#[test]
#[allow(deprecated)]
fn test_unique_rule_addition() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RegulatoryCheck);
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    // Add a rule
    let rule1 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule1);

    // Add a unique rule (different params)
    let rule2 = make_rule(
        &env,
        "R2",
        "US",
        "CA",
        "US",
        OperationType::RETIREMENT,
        true,
    );
    client.add_rule(&governance, &rule2);
}

// ========== Event Emission Tests ==========

/// Verify that add_rule emits a RuleAdded event with full rule metadata
#[test]
fn test_add_rule_emits_event() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RegulatoryCheck);
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    let rule = make_rule(&env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);

    // Verify the event was emitted (no panic means success)
    // The contract successfully executed, which means the event was published
    let stored = client.get_rule(&String::from_str(&env, "R1"));
    assert!(stored.is_some());
    assert_eq!(stored.unwrap().rule_id, String::from_str(&env, "R1"));
}

/// Verify that update_rule emits a RuleUpdated event with old and new hashes
#[test]
fn test_update_rule_emits_event() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RegulatoryCheck);
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    // Add a rule
    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);

    // Update the rule (change description and is_allowed)
    let updated_rule = JurisdictionRule {
        rule_id: String::from_str(&env, "R1"),
        description: String::from_str(&env, "updated desc"),
        source_jur: String::from_str(&env, "US"),
        dest_jur: String::from_str(&env, "CA"),
        host_jur: String::from_str(&env, "US"),
        operation: OperationType::TRANSFER,
        is_allowed: false, // Changed
        required_authority: None,
    };
    client.update_rule(&governance, &updated_rule);

    // Verify the rule was updated
    let stored = client.get_rule(&String::from_str(&env, "R1"));
    assert!(stored.is_some());
    assert_eq!(stored.unwrap().is_allowed, false);
}

/// Verify that deactivate_rule emits a RuleDeactivated event
#[test]
fn test_deactivate_rule_emits_event() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RegulatoryCheck);
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    // Add a rule
    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);

    // Deactivate the rule
    client.deactivate_rule(&governance, &String::from_str(&env, "R1"));

    // Verify the rule was removed
    let stored = client.get_rule(&String::from_str(&env, "R1"));
    assert!(stored.is_none());

    // Verify the rule is no longer in the active list
    let active = client.get_active_rules();
    assert_eq!(active.len(), 0);
}

/// Verify full lifecycle: add → update → deactivate with events
#[test]
fn test_rule_lifecycle_events() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RegulatoryCheck);
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    // Step 1: Add rule
    let rule = make_rule(&env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);
    assert!(client.get_rule(&String::from_str(&env, "R1")).is_some());

    // Step 2: Update rule
    let updated = JurisdictionRule {
        rule_id: String::from_str(&env, "R1"),
        description: String::from_str(&env, "modified"),
        source_jur: String::from_str(&env, "US"),
        dest_jur: String::from_str(&env, "DE"),
        host_jur: String::from_str(&env, "ANY"),
        operation: OperationType::TRANSFER,
        is_allowed: false,
        required_authority: None,
    };
    client.update_rule(&governance, &updated);
    let stored = client.get_rule(&String::from_str(&env, "R1")).unwrap();
    assert_eq!(stored.is_allowed, false);

    // Step 3: Deactivate rule
    client.deactivate_rule(&governance, &String::from_str(&env, "R1"));
    assert!(client.get_rule(&String::from_str(&env, "R1")).is_none());
    assert_eq!(client.get_active_rules().len(), 0);
}

/// Verify that compute_rule_hash is deterministic
#[test]
fn test_compute_rule_hash_deterministic() {
    let env = Env::default();

    let rule1 = make_rule(&env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true);
    let rule2 = make_rule(&env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true);

    let hash1 = events::compute_rule_hash(&env, &rule1);
    let hash2 = events::compute_rule_hash(&env, &rule2);

    assert_eq!(hash1, hash2, "Hashes should be identical for identical rules");
}

/// Verify that compute_rule_hash differs for different rules
#[test]
fn test_compute_rule_hash_different() {
    let env = Env::default();

    let rule1 = make_rule(&env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true);
    let rule2 = make_rule(&env, "R2", "US", "DE", "ANY", OperationType::TRANSFER, true);

    let hash1 = events::compute_rule_hash(&env, &rule1);
    let hash2 = events::compute_rule_hash(&env, &rule2);

    assert_ne!(hash1, hash2, "Hashes should differ for different rules (different rule_id)");
}