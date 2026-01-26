#![cfg(test)]

use crate::{BufferPoolContract, BufferPoolContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_test_env<'a>() -> (Env, Address, Address, Address, BufferPoolContractClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let carbon_contract = Address::generate(&env);

    let client = BufferPoolContractClient::new(&env, &env.register(BufferPoolContract, ()));

    (env, admin, governance, carbon_contract, client)
}

#[test]
fn test_initialize() {
    let (_, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 0);
}

#[test]
fn test_initialize_twice_fails() {
    let (_, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);
    let result = client.try_initialize(&admin, &governance, &carbon_contract, &500);

    assert!(result.is_err());
}

#[test]
fn test_deposit_as_admin() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");
    client.deposit(&admin, &1, &project_id);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 1);

    let in_pool = client.is_token_in_pool(&1);
    assert!(in_pool);
}

#[test]
fn test_deposit_duplicate_fails() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");
    client.deposit(&admin, &1, &project_id);

    let result = client.try_deposit(&admin, &1, &project_id);
    assert!(result.is_err());
}

#[test]
fn test_withdraw_by_governance() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");
    client.deposit(&admin, &1, &project_id);

    client.withdraw_to_replace(&governance, &1, &999);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 0);
}

#[test]
fn test_auto_deposit_calculation() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");

    // With 5% (500 bp), every 20th token should be deposited
    let deposited = client.auto_deposit(&carbon_contract, &20, &project_id, &20);
    assert_eq!(deposited, true);

    let not_deposited = client.auto_deposit(&carbon_contract, &21, &project_id, &21);
    assert_eq!(not_deposited, false);
}

#[test]
fn test_invalid_percentage() {
    let (_, admin, governance, carbon_contract, client) = setup_test_env();

    let result = client.try_initialize(&admin, &governance, &carbon_contract, &15000);
    assert!(result.is_err());
}

#[test]
fn test_withdraw_nonexistent_token() {
    let (_, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let result = client.try_withdraw_to_replace(&governance, &999, &1);
    assert!(result.is_err());
}

#[test]
fn test_get_custody_record() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");
    client.deposit(&admin, &1, &project_id);

    let record = client.get_custody_record(&1);
    assert!(record.is_some());

    let record = record.unwrap();
    assert_eq!(record.token_id, 1);
    assert_eq!(record.project_id, project_id);
}

#[test]
fn test_set_replenishment_rate() {
    let (_, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    client.set_replenishment_rate(&governance, &1000);
}
