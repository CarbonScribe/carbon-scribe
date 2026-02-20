#![cfg(test)]

use buffer_pool::{BufferPoolContract, BufferPoolContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_full_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let carbon_contract = Address::generate(&env);

    let client = BufferPoolContractClient::new(&env, &env.register(BufferPoolContract, ()));

    // Initialize
    client.initialize(&admin, &governance, &carbon_contract, &500);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 0);

    // Auto-deposit during minting
    let project_id = String::from_str(&env, "PROJECT-001");

    for i in 1..=100 {
        let should_deposit = client.auto_deposit(&carbon_contract, &i, &project_id, &i);

        if i % 20 == 0 {
            assert_eq!(should_deposit, true);
        } else {
            assert_eq!(should_deposit, false);
        }
    }

    // Should have 5 tokens in pool (20, 40, 60, 80, 100)
    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 5);

    // Verify specific tokens
    assert!(client.is_token_in_pool(&20));
    assert!(client.is_token_in_pool(&40));
    assert!(!client.is_token_in_pool(&21));

    // Governance withdraws for replacement
    client.withdraw_to_replace(&governance, &20, &1000);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 4);

    assert!(!client.is_token_in_pool(&20));

    // Admin manually deposits
    let project_id_2 = String::from_str(&env, "PROJECT-002");
    client.deposit(&admin, &999, &project_id_2);

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 5);

    let record = client.get_custody_record(&999);
    assert!(record.is_some());
    assert_eq!(record.unwrap().project_id, project_id_2);
}

#[test]
fn test_governance_updates() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let new_governance = Address::generate(&env);
    let carbon_contract = Address::generate(&env);

    let client = BufferPoolContractClient::new(&env, &env.register(BufferPoolContract, ()));

    client.initialize(&admin, &governance, &carbon_contract, &500);

    // Change governance address
    client.set_governance_address(&governance, &new_governance);

    // Old governance should not work
    let result = client.try_set_replenishment_rate(&governance, &1000);
    assert!(result.is_err());

    // New governance should work
    client.set_replenishment_rate(&new_governance, &1000);

    // Verify new rate (10%)
    let project_id = String::from_str(&env, "PROJECT-001");

    // With 10% (1000 bp), every 10th token should be deposited
    let should_deposit = client.auto_deposit(&carbon_contract, &10, &project_id, &10);
    assert_eq!(should_deposit, true);

    let should_not_deposit = client.auto_deposit(&carbon_contract, &11, &project_id, &11);
    assert_eq!(should_not_deposit, false);
}

#[test]
fn test_multiple_projects() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let governance = Address::generate(&env);
    let carbon_contract = Address::generate(&env);

    let client = BufferPoolContractClient::new(&env, &env.register(BufferPoolContract, ()));

    client.initialize(&admin, &governance, &carbon_contract, &500);

    // Deposit from multiple projects
    let projects = vec![
        String::from_str(&env, "PROJECT-A"),
        String::from_str(&env, "PROJECT-B"),
        String::from_str(&env, "PROJECT-C"),
    ];

    for (i, project) in projects.iter().enumerate() {
        client.deposit(&admin, &((i as u32) + 1), project);
    }

    let tvl = client.get_total_value_locked();
    assert_eq!(tvl, 3);

    // Verify each record
    let record_a = client.get_custody_record(&1).unwrap();
    assert_eq!(record_a.project_id, projects[0]);

    let record_b = client.get_custody_record(&2).unwrap();
    assert_eq!(record_b.project_id, projects[1]);

    let record_c = client.get_custody_record(&3).unwrap();
    assert_eq!(record_c.project_id, projects[2]);
}
