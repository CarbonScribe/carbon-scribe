#![cfg(test)]

use super::{CarbonAsset, CarbonAssetClient};
use crate::errors::ContractError;
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

fn make_meta(env: &Env) -> CarbonAssetMetadata {
    CarbonAssetMetadata {
        project_id: String::from_str(env, "PROJ-1"),
        vintage_year: 1704067200,
        methodology_id: 1,
        geo_hash: BytesN::from_array(env, &[7u8; 32]),
        max_supply: None,
    }
}

fn setup_client<'a>(
    env: &'a Env,
    admin: &Address,
    retirement_tracker: &Address,
) -> (Address, CarbonAssetClient<'a>) {
    let contract_id = env.register(CarbonAsset, ());
    let client = CarbonAssetClient::new(env, &contract_id);
    client.initialize(
        admin,
        &String::from_str(env, "Carbon Asset"),
        &String::from_str(env, "C01"),
        retirement_tracker,
        &String::from_str(env, "US"),
    );
    (contract_id, client)
}

// ====================================================================
// Existing tests (preserved)
// ====================================================================

#[test]
fn test_mint_and_transfer_token() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let meta = make_meta(&env);

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
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let meta = CarbonAssetMetadata {
        project_id: String::from_str(&env, "PROJ-1"),
        vintage_year: 1704067200,
        methodology_id: 1,
        geo_hash: BytesN::from_array(&env, &[9u8; 32]),
        max_supply: None,
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
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let meta = CarbonAssetMetadata {
        project_id: String::from_str(&env, "PROJ-2"),
        vintage_year: 1704067200,
        methodology_id: 2,
        geo_hash: BytesN::from_array(&env, &[3u8; 32]),
        max_supply: None,
    };

    let token_id = client.mint(&admin, &owner, &meta);
    client.transfer(&owner, &retirement_tracker, &1);
    assert_eq!(client.get_status(&token_id), AssetStatus::Retired);
}

#[test]
fn test_event_sequence_persistence_in_storage() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);

    // Check sequence incremented to 2 (MintEvent + StatusChangeEvent)
    let sequence = client.get_event_sequence();
    assert_eq!(sequence, 2);
}

// ====================================================================
// Mint cap tests (issue #472)
// ====================================================================

/// After initialisation with no cap set, TotalMinted should be 0 and
/// get_max_supply() / get_remaining_supply() should return None.
#[test]
fn test_initial_state_no_cap() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    assert_eq!(client.get_total_minted(), 0);
    assert_eq!(client.get_max_supply(), None);
    assert_eq!(client.get_remaining_supply(), None);
    assert!(!client.is_minting_frozen());
}

/// TotalMinted counter should increment with every successful mint.
#[test]
fn test_total_minted_counter_increments() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let meta = make_meta(&env);

    assert_eq!(client.get_total_minted(), 0);
    client.mint(&admin, &owner, &meta);
    assert_eq!(client.get_total_minted(), 1);
    client.mint(&admin, &owner, &meta);
    assert_eq!(client.get_total_minted(), 2);
}

/// set_max_supply() should persist the cap and emit MintCapSetEvent.
#[test]
fn test_set_max_supply_success() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.set_max_supply(&admin, &10);
    assert_eq!(client.get_max_supply(), Some(10));
    assert_eq!(client.get_remaining_supply(), Some(10));
}

/// get_remaining_supply() should decrease as tokens are minted.
#[test]
fn test_remaining_supply_decrements() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.set_max_supply(&admin, &5);
    assert_eq!(client.get_remaining_supply(), Some(5));

    let meta = make_meta(&env);
    client.mint(&admin, &owner, &meta);
    assert_eq!(client.get_remaining_supply(), Some(4));

    client.mint(&admin, &owner, &meta);
    assert_eq!(client.get_remaining_supply(), Some(3));
}

/// Minting should succeed exactly up to the cap (boundary test).
#[test]
fn test_mint_exactly_at_cap_succeeds() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.set_max_supply(&admin, &3);
    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);
    let third = client.mint(&admin, &owner, &meta);

    assert_eq!(third, 3);
    assert_eq!(client.get_total_minted(), 3);
    assert_eq!(client.get_remaining_supply(), Some(0));
}

/// Minting beyond the cap should return SupplyLimitExceeded.
#[test]
fn test_mint_exceeds_cap_returns_error() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.set_max_supply(&admin, &2);
    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    // Third mint should fail
    let result = client.try_mint(&admin, &owner, &meta);
    assert_eq!(result, Err(Ok(ContractError::SupplyLimitExceeded)));
}

/// set_max_supply() cannot be called more than once (immutable after first set).
#[test]
fn test_set_max_supply_only_once() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.set_max_supply(&admin, &100);

    let result = client.try_set_max_supply(&admin, &200);
    assert_eq!(result, Err(Ok(ContractError::MaxSupplyAlreadySet)));
}

/// set_max_supply() should fail if new cap is below the current minted count.
#[test]
fn test_set_max_supply_below_minted_returns_error() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let meta = make_meta(&env);
    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    // Attempting to cap below already-minted count should fail
    let result = client.try_set_max_supply(&admin, &2);
    assert_eq!(result, Err(Ok(ContractError::MaxSupplyBelowMinted)));
}

/// Only the admin should be able to set the max supply.
#[test]
fn test_set_max_supply_unauthorized() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let result = client.try_set_max_supply(&owner, &10);
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
}

/// freeze_minting() should prevent any further minting.
#[test]
fn test_freeze_minting_blocks_mint() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.freeze_minting(&admin);
    assert!(client.is_minting_frozen());

    let meta = make_meta(&env);
    let result = client.try_mint(&admin, &owner, &meta);
    assert_eq!(result, Err(Ok(ContractError::MintingIsFrozen)));
}

/// freeze_minting() should work even without a max supply cap set.
#[test]
fn test_freeze_minting_without_cap() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    // Mint successfully first
    let meta = make_meta(&env);
    client.mint(&admin, &owner, &meta);
    assert_eq!(client.get_total_minted(), 1);

    // Freeze
    client.freeze_minting(&admin);

    // Further minting must fail
    let result = client.try_mint(&admin, &owner, &meta);
    assert_eq!(result, Err(Ok(ContractError::MintingIsFrozen)));
}

/// Only the admin should be able to freeze minting.
#[test]
fn test_freeze_minting_unauthorized() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let result = client.try_freeze_minting(&owner);
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
}

/// Existing transfer functionality should continue to work when a cap is set.
#[test]
fn test_existing_functionality_with_cap() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    client.set_max_supply(&admin, &5);
    let meta = make_meta(&env);

    let token_id = client.mint(&admin, &owner, &meta);
    assert_eq!(token_id, 1);
    assert_eq!(client.get_remaining_supply(), Some(4));

    let buyer = Address::generate(&env);
    client.transfer(&owner, &buyer, &1);
    assert_eq!(client.owner_of(&token_id), buyer);
    // Transfer does NOT affect TotalMinted
    assert_eq!(client.get_total_minted(), 1);
}

// ====================================================================
// Tests for transfer_token and transfer_token_from (#522)
// ====================================================================

/// transfer_token moves exactly the specified token ID, not a count-based
/// selection.
#[test]
fn test_transfer_token_moves_exact_token_id() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let meta = make_meta(&env);

    // Mint tokens 1, 2, 3 to owner
    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    let buyer = Address::generate(&env);

    // transfer_token for token_id 2 specifically
    client.transfer_token(&owner, &buyer, &2);

    // Only token 2 should have moved
    assert_eq!(client.owner_of(&2), buyer);
    // Tokens 1 and 3 should still be owned by owner
    assert_eq!(client.owner_of(&1), owner);
    assert_eq!(client.owner_of(&3), owner);
    assert_eq!(client.balance(&owner), 2);
    assert_eq!(client.balance(&buyer), 1);
}

/// transfer_token fails when the caller does not own the specified token.
#[test]
fn test_transfer_token_fails_for_wrong_owner() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);

    let stranger = Address::generate(&env);
    let buyer = Address::generate(&env);

    let result = client.try_transfer_token(&stranger, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::NotOwner)));
}

/// transfer_token_from moves exactly the specified token via allowance.
#[test]
fn test_transfer_token_from_moves_exact_token_id() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let meta = make_meta(&env);

    // Mint tokens 1, 2, 3 to owner
    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    let spender = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Approve spender for at least 1 unit
    client.approve(&owner, &spender, &1, &env.ledger().sequence());

    // transfer_token_from moves exactly token_id 3
    client.transfer_token_from(&spender, &owner, &buyer, &3);

    assert_eq!(client.owner_of(&3), buyer);
    assert_eq!(client.owner_of(&1), owner);
    assert_eq!(client.owner_of(&2), owner);
    assert_eq!(client.balance(&buyer), 1);
}

/// transfer_token_from fails without sufficient allowance.
#[test]
fn test_transfer_token_from_fails_without_allowance() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);

    let spender = Address::generate(&env);
    let buyer = Address::generate(&env);

    // No approval — should fail
    let result = client.try_transfer_token_from(&spender, &owner, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
}

/// transfer_token_from deducts exactly 1 from allowance (not token_id).
#[test]
fn test_transfer_token_from_deducts_one_from_allowance() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    let spender = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Approve 3 units of allowance
    client.approve(&owner, &spender, &3, &env.ledger().sequence());

    // transfer token_id 2 — should spend 1 allowance, not 2
    client.transfer_token_from(&spender, &owner, &buyer, &2);

    assert_eq!(client.allowance(&owner, &spender), 2);
    assert_eq!(client.owner_of(&2), buyer);
    assert_eq!(client.owner_of(&1), owner);
}

/// Existing count-based transfer still works correctly after adding
/// transfer_token / transfer_token_from.
#[test]
fn test_count_based_transfer_still_works() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let meta = make_meta(&env);

    client.mint(&admin, &owner, &meta);
    client.mint(&admin, &owner, &meta);

    let buyer = Address::generate(&env);

    // Count-based: transfer 2 tokens
    client.transfer(&owner, &buyer, &2);
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&buyer), 2);
}
