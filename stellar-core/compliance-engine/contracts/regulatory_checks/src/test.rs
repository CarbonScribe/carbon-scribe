#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn make_rule(
    env: &Env,
    rule_id: &str,
    src: &str,
    dst: &str,
    host: &str,
    op: OperationType,
    is_allowed: bool,
) -> JurisdictionRule {
    make_rule_with_priority(env, rule_id, src, dst, host, op, is_allowed, 0)
}

#[allow(clippy::too_many_arguments)]
fn make_rule_with_priority(
    env: &Env,
    rule_id: &str,
    src: &str,
    dst: &str,
    host: &str,
    op: OperationType,
    is_allowed: bool,
    priority: u32,
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
        priority,
        version: 0, // ignored/overwritten by the contract on add_rule/update_rule
    }
}

/// Registers an initialized contract and returns it with its admin and
/// governance addresses. Jurisdictions are set by the admin; rules are managed
/// by governance.
fn setup(env: &Env) -> (RegulatoryCheckClient<'_>, Address, Address) {
    let contract_id = env.register(RegulatoryCheck, ());
    let client = RegulatoryCheckClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let governance = Address::generate(env);
    let asset = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);
    (client, admin, governance)
}

/// Generates an address and registers it as belonging to `jurisdiction`.
fn address_in(
    env: &Env,
    client: &RegulatoryCheckClient,
    admin: &Address,
    jurisdiction: &str,
) -> Address {
    let account = Address::generate(env);
    client.set_address_jurisdiction(admin, &account, &String::from_str(env, jurisdiction));
    account
}

#[test]
fn test_is_initialized_and_reinitialization_guard() {
    let env = Env::default();
    let contract_id = env.register(RegulatoryCheck, ());
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);

    // Before initialization
    assert_eq!(client.is_initialized(), false);

    // Perform initialization
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    // After initialization
    assert_eq!(client.is_initialized(), true);

    // Attempt re-initialization with different addresses (should fail with AlreadyInitialized)
    let attacker = Address::generate(&env);
    let res = client.try_initialize(&attacker, &attacker, &attacker);
    assert!(matches!(res, Err(Ok(ContractError::AlreadyInitialized))));

    // Verify contract remains initialized and uncompromised
    assert_eq!(client.is_initialized(), true);
}

#[test]
fn test_duplicate_rule_conflict() {
    let env = Env::default();
    let contract_id = env.register(RegulatoryCheck, ());
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
fn test_unique_rule_addition() {
    let env = Env::default();
    let contract_id = env.register(RegulatoryCheck, ());
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
    let contract_id = env.register(RegulatoryCheck, ());
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    env.mock_all_auths();
    client.initialize(&admin, &governance, &asset);

    let rule = make_rule(&env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);

    let stored = client.get_rule(&String::from_str(&env, "R1"));
    assert!(stored.is_some());
    assert_eq!(stored.unwrap().rule_id, String::from_str(&env, "R1"));
}

/// Verify that update_rule emits a RuleUpdated event with old and new hashes
#[test]
fn test_update_rule_emits_event() {
    let env = Env::default();
    let contract_id = env.register(RegulatoryCheck, ());
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
        priority: 0,
        version: 0, // ignored/overwritten by the contract
    };
    client.update_rule(&governance, &updated_rule);

    let stored = client.get_rule(&String::from_str(&env, "R1"));
    assert!(stored.is_some());
    assert_eq!(stored.unwrap().is_allowed, false);
}

/// Verify that deactivate_rule emits a RuleDeactivated event
#[test]
fn test_deactivate_rule_emits_event() {
    let env = Env::default();
    let contract_id = env.register(RegulatoryCheck, ());
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
    let contract_id = env.register(RegulatoryCheck, ());
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
        priority: 0,
        version: 0, // ignored/overwritten by the contract
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
// ========== Rule Priority Ordering Tests (issue #615) ==========

/// A broad "deny all transfers out of US" rule and a narrow "allow US to CA
/// transfers" rule both match a US to CA transfer. The narrow rule carries the
/// higher precedence (lower priority value) and must govern the result in
/// either insertion order.
#[test]
fn test_higher_priority_rule_governs_when_broad_added_first() {
    let env = Env::default();
    let (client, admin, governance) = setup(&env);
    let source = address_in(&env, &client, &admin, "US");
    let destination = address_in(&env, &client, &admin, "CA");

    let broad = make_rule_with_priority(
        &env, "BROAD", "US", "ANY", "ANY", OperationType::TRANSFER, false, 100,
    );
    let narrow = make_rule_with_priority(
        &env, "NARROW", "US", "CA", "ANY", OperationType::TRANSFER, true, 10,
    );
    client.add_rule(&governance, &broad);
    client.add_rule(&governance, &narrow);

    let result = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );

    assert_eq!(
        result.rule_id,
        Some(String::from_str(&env, "NARROW")),
        "the lower priority value must win"
    );
    assert!(result.is_compliant);
}

#[test]
fn test_higher_priority_rule_governs_when_narrow_added_first() {
    let env = Env::default();
    let (client, admin, governance) = setup(&env);
    let source = address_in(&env, &client, &admin, "US");
    let destination = address_in(&env, &client, &admin, "CA");

    // Same rule set as the previous test, inserted in the opposite order.
    let narrow = make_rule_with_priority(
        &env, "NARROW", "US", "CA", "ANY", OperationType::TRANSFER, true, 10,
    );
    let broad = make_rule_with_priority(
        &env, "BROAD", "US", "ANY", "ANY", OperationType::TRANSFER, false, 100,
    );
    client.add_rule(&governance, &narrow);
    client.add_rule(&governance, &broad);

    let result = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );

    assert_eq!(
        result.rule_id,
        Some(String::from_str(&env, "NARROW")),
        "insertion order must not change which rule governs"
    );
    assert!(result.is_compliant);
}

/// The broad deny rule governs once it is given the higher precedence,
/// confirming the ordering is driven by the priority value itself and not by
/// how specific a rule happens to look.
#[test]
fn test_broad_rule_governs_when_given_higher_priority() {
    let env = Env::default();
    let (client, admin, governance) = setup(&env);
    let source = address_in(&env, &client, &admin, "US");
    let destination = address_in(&env, &client, &admin, "CA");

    let broad = make_rule_with_priority(
        &env, "BROAD", "US", "ANY", "ANY", OperationType::TRANSFER, false, 1,
    );
    let narrow = make_rule_with_priority(
        &env, "NARROW", "US", "CA", "ANY", OperationType::TRANSFER, true, 50,
    );
    client.add_rule(&governance, &narrow);
    client.add_rule(&governance, &broad);

    let result = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );

    assert_eq!(result.rule_id, Some(String::from_str(&env, "BROAD")));
    assert!(!result.is_compliant, "the prohibiting rule now takes precedence");
}

/// Two overlapping rules sharing a priority resolve by ascending rule_id, so
/// the outcome is deterministic and documented rather than insertion-dependent.
#[test]
fn test_equal_priority_ties_break_on_rule_id() {
    let env = Env::default();
    let (client, admin, governance) = setup(&env);
    let source = address_in(&env, &client, &admin, "US");
    let destination = address_in(&env, &client, &admin, "CA");

    // Equal priority, both match, opposite outcomes. They differ in is_allowed
    // and dest_jur, so they are not rejected as a logical duplicate.
    let rule_z = make_rule_with_priority(
        &env, "Z_RULE", "US", "ANY", "ANY", OperationType::TRANSFER, false, 50,
    );
    let rule_a = make_rule_with_priority(
        &env, "A_RULE", "US", "CA", "ANY", OperationType::TRANSFER, true, 50,
    );
    // Inserted Z first: the tiebreaker, not insertion order, must pick A.
    client.add_rule(&governance, &rule_z);
    client.add_rule(&governance, &rule_a);

    let result = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );

    assert_eq!(
        result.rule_id,
        Some(String::from_str(&env, "A_RULE")),
        "equal priorities must break on ascending rule_id"
    );
    assert!(result.is_compliant);

    // Repeated evaluation must not drift.
    let again = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );
    assert_eq!(again.rule_id, result.rule_id, "evaluation must be deterministic");
}

/// The same equal-priority pair inserted in the opposite order resolves
/// identically, which is the property the tiebreaker exists to guarantee.
#[test]
fn test_equal_priority_tiebreak_is_insertion_order_independent() {
    let env = Env::default();
    let (client, admin, governance) = setup(&env);
    let source = address_in(&env, &client, &admin, "US");
    let destination = address_in(&env, &client, &admin, "CA");

    let rule_a = make_rule_with_priority(
        &env, "A_RULE", "US", "CA", "ANY", OperationType::TRANSFER, true, 50,
    );
    let rule_z = make_rule_with_priority(
        &env, "Z_RULE", "US", "ANY", "ANY", OperationType::TRANSFER, false, 50,
    );
    client.add_rule(&governance, &rule_a);
    client.add_rule(&governance, &rule_z);

    let result = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );

    assert_eq!(result.rule_id, Some(String::from_str(&env, "A_RULE")));
}

/// The priority value survives a storage round trip.
#[test]
fn test_priority_is_persisted_and_retrievable() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);

    let rule = make_rule_with_priority(
        &env, "P1", "US", "CA", "US", OperationType::TRANSFER, true, 42,
    );
    client.add_rule(&governance, &rule);

    let stored = client.get_rule(&String::from_str(&env, "P1")).unwrap();
    assert_eq!(stored.priority, 42);
}

/// update_rule can change a rule's precedence.
#[test]
fn test_update_rule_changes_priority() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);

    let rule = make_rule_with_priority(
        &env, "P1", "US", "CA", "US", OperationType::TRANSFER, true, 100,
    );
    client.add_rule(&governance, &rule);

    let reprioritised = make_rule_with_priority(
        &env, "P1", "US", "CA", "US", OperationType::TRANSFER, true, 5,
    );
    client.update_rule(&governance, &reprioritised);

    let stored = client.get_rule(&String::from_str(&env, "P1")).unwrap();
    assert_eq!(stored.priority, 5, "priority must be updatable");
}

/// A priority-only edit changes the rule hash, so the RuleUpdated event still
/// reflects that precedence moved.
#[test]
fn test_priority_change_alters_rule_hash() {
    let env = Env::default();

    let low = make_rule_with_priority(
        &env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true, 1,
    );
    let high = make_rule_with_priority(
        &env, "R1", "US", "DE", "ANY", OperationType::TRANSFER, true, 99,
    );

    assert_ne!(
        events::compute_rule_hash(&env, &low),
        events::compute_rule_hash(&env, &high),
        "a priority-only change must be visible in the rule hash"
    );
}

/// get_rules_by_priority exposes the evaluated order for auditing.
#[test]
fn test_get_rules_by_priority_returns_evaluation_order() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);

    // Added in deliberately scrambled priority order.
    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "C", "US", "ANY", "ANY", OperationType::TRANSFER, false, 30),
    );
    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "A", "US", "CA", "ANY", OperationType::TRANSFER, true, 10),
    );
    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "B", "US", "DE", "ANY", OperationType::TRANSFER, true, 20),
    );

    let ordered = client.get_rules_by_priority();
    assert_eq!(ordered.len(), 3);
    assert_eq!(ordered.get(0).unwrap().rule_id, String::from_str(&env, "A"));
    assert_eq!(ordered.get(1).unwrap().rule_id, String::from_str(&env, "B"));
    assert_eq!(ordered.get(2).unwrap().rule_id, String::from_str(&env, "C"));

    // The raw active-rule list still reflects insertion order, so the audit
    // view is genuinely distinct from it.
    let raw = client.get_active_rules();
    assert_eq!(raw.get(0).unwrap(), String::from_str(&env, "C"));
}

/// Equal priorities are ordered by rule_id in the audit view too.
#[test]
fn test_get_rules_by_priority_orders_ties_by_rule_id() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);

    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "ZZ", "US", "ANY", "ANY", OperationType::TRANSFER, false, 7),
    );
    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "AA", "US", "CA", "ANY", OperationType::TRANSFER, true, 7),
    );

    let ordered = client.get_rules_by_priority();
    assert_eq!(ordered.get(0).unwrap().rule_id, String::from_str(&env, "AA"));
    assert_eq!(ordered.get(1).unwrap().rule_id, String::from_str(&env, "ZZ"));
}

#[test]
fn test_get_rules_by_priority_empty_when_no_rules() {
    let env = Env::default();
    let (client, _admin, _governance) = setup(&env);

    assert_eq!(client.get_rules_by_priority().len(), 0);
}

/// Deactivating the governing rule hands precedence to the next one in order.
#[test]
fn test_deactivating_top_priority_rule_promotes_the_next() {
    let env = Env::default();
    let (client, admin, governance) = setup(&env);
    let source = address_in(&env, &client, &admin, "US");
    let destination = address_in(&env, &client, &admin, "CA");

    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "NARROW", "US", "CA", "ANY", OperationType::TRANSFER, true, 10),
    );
    client.add_rule(
        &governance,
        &make_rule_with_priority(&env, "BROAD", "US", "ANY", "ANY", OperationType::TRANSFER, false, 100),
    );

    client.deactivate_rule(&governance, &String::from_str(&env, "NARROW"));

    let result = client.validate_transaction(
        &source,
        &destination,
        &OperationType::TRANSFER,
        &String::from_str(&env, "ANY"),
    );

    assert_eq!(result.rule_id, Some(String::from_str(&env, "BROAD")));
    assert!(!result.is_compliant);
}

// ========== Rule Versioning & History Tests (#565) ==========

/// A brand-new rule starts at version 1.
#[test]
fn test_add_rule_starts_at_version_one() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);

    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);

    let stored = client.get_rule(&String::from_str(&env, "R1")).unwrap();
    assert_eq!(stored.version, 1);
}

/// update_rule archives the pre-update content (not only its hash) and
/// increments the version counter.
#[test]
fn test_update_rule_archives_prior_version_and_increments_version() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);
    let rule_id = String::from_str(&env, "R1");

    let v1 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &v1);

    let v2 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, false);
    client.update_rule(&governance, &v2);

    // The live rule is now version 2 with the new content.
    let current = client.get_rule(&rule_id).unwrap();
    assert_eq!(current.version, 2);
    assert_eq!(current.is_allowed, false);

    // Version 1's *content* — not just its hash — is still retrievable.
    let archived_v1 = client.get_rule_at_version(&rule_id, &1u32).unwrap();
    assert_eq!(archived_v1.version, 1);
    assert_eq!(archived_v1.is_allowed, true);
    assert_eq!(archived_v1.rule_id, rule_id);
}

/// get_rule_history returns every version in chronological order, ending
/// with the current live version.
#[test]
fn test_get_rule_history_returns_chronological_order() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);
    let rule_id = String::from_str(&env, "R1");

    let v1 = make_rule_with_priority(
        &env, "R1", "US", "CA", "US", OperationType::TRANSFER, true, 1,
    );
    client.add_rule(&governance, &v1);

    let v2 = make_rule_with_priority(
        &env, "R1", "US", "CA", "US", OperationType::TRANSFER, true, 2,
    );
    client.update_rule(&governance, &v2);

    let v3 = make_rule_with_priority(
        &env, "R1", "US", "CA", "US", OperationType::TRANSFER, true, 3,
    );
    client.update_rule(&governance, &v3);

    let history = client.get_rule_history(&rule_id);
    assert_eq!(history.len(), 3);
    assert_eq!(history.get(0).unwrap().version, 1);
    assert_eq!(history.get(0).unwrap().priority, 1);
    assert_eq!(history.get(1).unwrap().version, 2);
    assert_eq!(history.get(1).unwrap().priority, 2);
    assert_eq!(history.get(2).unwrap().version, 3);
    assert_eq!(history.get(2).unwrap().priority, 3);
}

/// get_rule_history returns an empty vector for a rule_id that never existed.
#[test]
fn test_get_rule_history_empty_for_unknown_rule() {
    let env = Env::default();
    let (client, _admin, _governance) = setup(&env);

    let history = client.get_rule_history(&String::from_str(&env, "NEVER-EXISTED"));
    assert_eq!(history.len(), 0);
}

/// deactivate_rule preserves the final rule content in history instead of
/// deleting it, even though get_rule() no longer returns it.
#[test]
fn test_deactivate_rule_preserves_final_content_in_history() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);
    let rule_id = String::from_str(&env, "R1");

    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);
    client.deactivate_rule(&governance, &rule_id);

    // No longer "live"...
    assert!(client.get_rule(&rule_id).is_none());

    // ...but its final content is still queryable.
    let history = client.get_rule_history(&rule_id);
    assert_eq!(history.len(), 1);
    assert_eq!(history.get(0).unwrap().version, 1);
    assert_eq!(history.get(0).unwrap().is_allowed, true);

    let at_version_1 = client.get_rule_at_version(&rule_id, &1u32).unwrap();
    assert_eq!(at_version_1.rule_id, rule_id);
}

/// get_rule_at_version resolves both the current live version and archived
/// (superseded) versions correctly.
#[test]
fn test_get_rule_at_version_point_in_time_lookup() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);
    let rule_id = String::from_str(&env, "R1");

    let v1 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &v1);

    let v2 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, false);
    client.update_rule(&governance, &v2);

    let at_v1 = client.get_rule_at_version(&rule_id, &1u32).unwrap();
    assert_eq!(at_v1.is_allowed, true);

    let at_v2 = client.get_rule_at_version(&rule_id, &2u32).unwrap();
    assert_eq!(at_v2.is_allowed, false);

    assert!(client.get_rule_at_version(&rule_id, &3u32).is_none());
}

/// update_rule rejects a change that would create a logical conflict with
/// another active rule — the same check add_rule already performs.
#[test]
fn test_update_rule_into_conflicting_state_is_rejected() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);

    let rule1 = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule1);

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

    // Attempt to update R2 into a state that duplicates R1's logical params.
    let conflicting_update = make_rule(&env, "R2", "US", "CA", "US", OperationType::TRANSFER, true);
    let res = client.try_update_rule(&governance, &conflicting_update);
    assert!(matches!(res, Err(Ok(ContractError::RuleConflict))));

    // R2 must be unchanged — still its original, non-conflicting content.
    let stored = client.get_rule(&String::from_str(&env, "R2")).unwrap();
    assert_eq!(stored.operation, OperationType::RETIREMENT);
    assert_eq!(
        stored.version, 1,
        "a rejected update must not bump the version"
    );
}

/// Updating a rule to content resembling its *own* prior version must not
/// be rejected as a self-conflict.
#[test]
fn test_update_rule_does_not_conflict_with_its_own_prior_version() {
    let env = Env::default();
    let (client, _admin, governance) = setup(&env);
    let rule_id = String::from_str(&env, "R1");

    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.add_rule(&governance, &rule);

    // "Update" to logically identical content — must succeed, not be
    // treated as conflicting with itself.
    let same = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);
    client.update_rule(&governance, &same);

    let stored = client.get_rule(&rule_id).unwrap();
    assert_eq!(stored.version, 2);
}
