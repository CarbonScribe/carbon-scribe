#![cfg(test)]

use crate::{BufferPoolContract, BufferPoolContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

// A mock contract to handle the cross-contract "transfer" call
#[soroban_sdk::contract]
pub struct MockAssetContract;

#[soroban_sdk::contractimpl]
impl MockAssetContract {
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        // Returns successfully to simulate a valid transfer
    }
}

// A mock contract specifically designed to simulate an invocation failure
#[soroban_sdk::contract]
pub struct FailingAssetContract;

#[soroban_sdk::contractimpl]
impl FailingAssetContract {
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        panic!("Transfer failed");
    }
}

fn setup_test_env<'a>() -> (Env, Address, Address, Address, BufferPoolContractClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let governance = Address::generate(&env);

    // Register the mock asset contract so it handles standard contract calls
    let carbon_contract = env.register(MockAssetContract, ());

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

    // This triggers the underlying cross-contract mock transfer successfully
    client.withdraw_to_replace(&governance, &1, &999);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 0);

    let in_pool = client.is_token_in_pool(&1);
    assert!(!in_pool);
}

#[test]
fn test_withdraw_failed_transfer_retains_custody() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let governance = Address::generate(&env);

    // Deploy the explicitly failing asset contract
    let failing_carbon_contract = env.register(FailingAssetContract, ());
    let client = BufferPoolContractClient::new(&env, &env.register(BufferPoolContract, ()));

    client.initialize(&admin, &governance, &failing_carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");
    client.deposit(&admin, &5, &project_id);

    // Call should return an error because the mock asset contract panics
    let result = client.try_withdraw_to_replace(&governance, &5, &999);
    assert!(result.is_err());

    // Verify atomicity: state is restored and custody record is retained
    assert!(client.is_token_in_pool(&5));
    assert_eq!(client.get_total_value_locked(), 1);
}

#[test]
fn test_auto_deposit_calculation() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");

    // With 5% (500 bp), every 20th token should be deposited
    // Client invoker auto-unwraps Result layer to bool here
    let deposited = client.auto_deposit(&carbon_contract, &20, &project_id, &20);
    assert_eq!(deposited, true);

    let not_deposited = client.auto_deposit(&carbon_contract, &21, &project_id, &21);
    assert_eq!(not_deposited, false);
}

#[test]
fn test_auto_deposit_duplicate_protection() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");

    // First auto-deposit should succeed
    let deposited = client.auto_deposit(&carbon_contract, &20, &project_id, &20);
    assert_eq!(deposited, true);

    // Second auto-deposit with same token_id should return false (duplicate protection)
    let duplicate = client.auto_deposit(&carbon_contract, &20, &project_id, &20);
    assert_eq!(duplicate, false);

    // TVL should only be incremented once
    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 1);
}

#[test]
fn test_auto_deposit_after_manual_deposit() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");

    // Manual deposit first
    client.deposit(&admin, &20, &project_id);

    // Auto-deposit with same token_id should return false (duplicate protection)
    let deposited = client.auto_deposit(&carbon_contract, &20, &project_id, &20);
    assert_eq!(deposited, false);

    // TVL should only be incremented once
    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 1);
}

#[test]
fn test_manual_deposit_after_auto_deposit() {
    let (env, admin, governance, carbon_contract, client) = setup_test_env();

    client.initialize(&admin, &governance, &carbon_contract, &500);

    let project_id = String::from_str(&env, "PROJECT-001");

    // Auto-deposit first
    let deposited = client.auto_deposit(&carbon_contract, &20, &project_id, &20);
    assert_eq!(deposited, true);

    // Manual deposit with same token_id should fail
    let result = client.try_deposit(&admin, &20, &project_id);
    assert!(result.is_err());

    // TVL should only be incremented once
    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 1);
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

    // Using try_ variant returns the Result type required to test cleanly for Ok status
    let result = client.try_set_replenishment_rate(&governance, &1000);
    assert!(result.is_ok());
}
