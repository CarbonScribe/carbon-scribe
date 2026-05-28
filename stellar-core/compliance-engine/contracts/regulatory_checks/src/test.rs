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
