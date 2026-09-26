//! Integration tests for issue #519: every state-mutating entrypoint that
//! reads Governance/Admin from instance storage must return
//! ContractError::NotInitialized when called before initialize(), instead
//! of panicking with an undifferentiated host trap. Also covers the
//! loop-bound paths (add_rule's conflict scan, deactivate_rule's rebuild,
//! validate_transaction's rule match) that were previously indexed via
//! `active_rules.get(i).unwrap()`.

use regulatory_checks::{
    ContractError, JurisdictionRule, OperationType, RegulatoryCheck, RegulatoryCheckClient,
};
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

fn setup_uninitialized() -> (Env, RegulatoryCheckClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RegulatoryCheck, ());
    let client = RegulatoryCheckClient::new(&env, &contract_id);
    (env, client)
}

// ============================================================================
// Pre-initialization guards on the six affected entrypoints
// ============================================================================

#[test]
fn add_rule_before_init_returns_not_initialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);
    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);

    let result = client.try_add_rule(&caller, &rule);
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn update_rule_before_init_returns_not_initialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);
    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);

    let result = client.try_update_rule(&caller, &rule);
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn deactivate_rule_before_init_returns_not_initialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);

    let result = client.try_deactivate_rule(&caller, &String::from_str(&env, "R1"));
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn set_address_jurisdiction_before_init_returns_not_initialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);
    let account = Address::generate(&env);

    let result =
        client.try_set_address_jurisdiction(&caller, &account, &String::from_str(&env, "US"));
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn update_admin_before_init_returns_not_initialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let result = client.try_update_admin(&caller, &new_admin);
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

#[test]
fn update_governance_before_init_returns_not_initialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);
    let new_governance = Address::generate(&env);

    let result = client.try_update_governance(&caller, &new_governance);
    assert_eq!(result, Err(Ok(ContractError::NotInitialized)));
}

// ============================================================================
// None of the six should have touched storage before failing
// ============================================================================

#[test]
fn failed_pre_init_calls_leave_contract_uninitialized() {
    let (env, client) = setup_uninitialized();
    let caller = Address::generate(&env);
    let rule = make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true);

    let _ = client.try_add_rule(&caller, &rule);
    let _ = client.try_update_admin(&caller, &caller);
    let _ = client.try_update_governance(&caller, &caller);

    assert!(!client.is_initialized());
    assert!(client.get_rule(&String::from_str(&env, "R1")).is_none());
}

// ============================================================================
// Loop-bound paths (previously active_rules.get(i).unwrap()) with a
// multi-element active rules list, now iterated via .iter()
// ============================================================================

#[test]
fn add_rule_conflict_is_detected_among_multiple_active_rules() {
    let (env, client) = setup_uninitialized();
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    client.initialize(&admin, &governance, &asset);

    // Populate several active rules before the conflict check runs.
    client.add_rule(
        &governance,
        &make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true),
    );
    client.add_rule(
        &governance,
        &make_rule(
            &env,
            "R2",
            "US",
            "DE",
            "US",
            OperationType::TRANSFER,
            true,
        ),
    );
    client.add_rule(
        &governance,
        &make_rule(
            &env,
            "R3",
            "US",
            "FR",
            "US",
            OperationType::RETIREMENT,
            true,
        ),
    );

    // A logical duplicate of R1 (different id, same fields) must still be
    // caught even with three other rules ahead of it in the active list.
    let conflicting = make_rule(&env, "R4", "US", "CA", "US", OperationType::TRANSFER, true);
    let result = client.try_add_rule(&governance, &conflicting);
    assert_eq!(result, Err(Ok(ContractError::RuleConflict)));

    // A genuinely unique rule is still accepted.
    let unique = make_rule(
        &env,
        "R5",
        "US",
        "JP",
        "US",
        OperationType::TRANSFER,
        true,
    );
    client.add_rule(&governance, &unique);
    assert!(client.get_rule(&String::from_str(&env, "R5")).is_some());
}

#[test]
fn deactivate_rule_removes_only_the_targeted_rule_from_multiple() {
    let (env, client) = setup_uninitialized();
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    client.initialize(&admin, &governance, &asset);

    client.add_rule(
        &governance,
        &make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true),
    );
    client.add_rule(
        &governance,
        &make_rule(
            &env,
            "R2",
            "US",
            "DE",
            "US",
            OperationType::TRANSFER,
            true,
        ),
    );
    client.add_rule(
        &governance,
        &make_rule(
            &env,
            "R3",
            "US",
            "FR",
            "US",
            OperationType::RETIREMENT,
            true,
        ),
    );

    client.deactivate_rule(&governance, &String::from_str(&env, "R2"));

    let active = client.get_active_rules();
    assert_eq!(active.len(), 2);
    assert!(client.get_rule(&String::from_str(&env, "R1")).is_some());
    assert!(client.get_rule(&String::from_str(&env, "R2")).is_none());
    assert!(client.get_rule(&String::from_str(&env, "R3")).is_some());
}

#[test]
fn validate_transaction_matches_correct_rule_among_multiple() {
    let (env, client) = setup_uninitialized();
    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let asset = Address::generate(&env);
    client.initialize(&admin, &governance, &asset);

    client.add_rule(
        &governance,
        &make_rule(&env, "R1", "US", "CA", "US", OperationType::TRANSFER, true),
    );
    client.add_rule(
        &governance,
        &make_rule(
            &env,
            "R2",
            "US",
            "DE",
            "US",
            OperationType::TRANSFER,
            false,
        ),
    );
    client.add_rule(
        &governance,
        &make_rule(
            &env,
            "R3",
            "US",
            "FR",
            "US",
            OperationType::RETIREMENT,
            true,
        ),
    );

    let source = Address::generate(&env);
    let dest = Address::generate(&env);
    client.set_address_jurisdiction(&admin, &source, &String::from_str(&env, "US"));
    client.set_address_jurisdiction(&admin, &dest, &String::from_str(&env, "DE"));

    // Should match R2 specifically (third rule checked, US -> DE, prohibited).
    let result = client.validate_transaction(
        &source,
        &dest,
        &OperationType::TRANSFER,
        &String::from_str(&env, "US"),
    );
    assert_eq!(result.rule_id, Some(String::from_str(&env, "R2")));
    assert!(!result.is_compliant);
}
