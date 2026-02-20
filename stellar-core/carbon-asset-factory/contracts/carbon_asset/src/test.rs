#![cfg(test)]

use super::{CarbonAsset, CarbonAssetClient};
use crate::types::{AssetStatus, CarbonAssetMetadata};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env, String};

fn setup_env() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let retirement_tracker = Address::generate(&env);
    let owner = Address::generate(&env);
    (env, admin, retirement_tracker, owner)
}

#[test]
fn test_mint_and_transfer_token() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let contract_id = env.register(CarbonAsset, ());
    let client = CarbonAssetClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Carbon Asset"),
        &String::from_str(&env, "C01"),
        &retirement_tracker,
        &String::from_str(&env, "US"),
    );

    let meta = CarbonAssetMetadata {
        project_id: String::from_str(&env, "PROJ-1"),
        vintage_year: 1704067200,
        methodology_id: 1,
        geo_hash: BytesN::from_array(&env, &[7u8; 32]),
    };

    let token_id = client.mint(&admin, &owner, &meta);
    assert_eq!(token_id, 1);
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.owner_of(&token_id), owner);

    let buyer = Address::generate(&env);
    client.transfer(&owner, &buyer, &1);
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&buyer), 1);
    assert_eq!(client.owner_of(&token_id), buyer);
}

#[test]
fn test_transfer_amount_and_allowance() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let contract_id = env.register(CarbonAsset, ());
    let client = CarbonAssetClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Carbon Asset"),
        &String::from_str(&env, "C01"),
        &retirement_tracker,
        &String::from_str(&env, "US"),
    );

    let meta = CarbonAssetMetadata {
        project_id: String::from_str(&env, "PROJ-1"),
        vintage_year: 1704067200,
        methodology_id: 1,
        geo_hash: BytesN::from_array(&env, &[9u8; 32]),
    };

    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    let buyer = Address::generate(&env);
    client.transfer(&owner, &buyer, &2);
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&buyer), 2);

    let spender = Address::generate(&env);
    client.approve(&buyer, &spender, &1, &env.ledger().sequence());
    let recipient = Address::generate(&env);
    client.transfer_from(&spender, &buyer, &recipient, &1);
    assert_eq!(client.balance(&buyer), 1);
    assert_eq!(client.balance(&recipient), 1);
}

#[test]
fn test_transfer_to_retirement_tracker_sets_status() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let contract_id = env.register(CarbonAsset, ());
    let client = CarbonAssetClient::new(&env, &contract_id);

    client.initialize(
        &admin,
        &String::from_str(&env, "Carbon Asset"),
        &String::from_str(&env, "C01"),
        &retirement_tracker,
        &String::from_str(&env, "US"),
    );

    let meta = CarbonAssetMetadata {
        project_id: String::from_str(&env, "PROJ-2"),
        vintage_year: 1704067200,
        methodology_id: 2,
        geo_hash: BytesN::from_array(&env, &[3u8; 32]),
    };

    let token_id = client.mint(&admin, &owner, &meta);
    client.transfer(&owner, &retirement_tracker, &1);
    assert_eq!(client.get_status(&token_id), AssetStatus::Retired);
}
