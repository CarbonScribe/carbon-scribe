#![cfg(test)]

use super::{CarbonAsset, CarbonAssetClient};
use crate::errors::ContractError;
use crate::types::{AssetStatus, CarbonAssetMetadata, OperationType, ValidationResult};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{contract, contracterror, contractimpl, Address, BytesN, Env, String};

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

// Two-step admin transfer tests (issue #557)
// ====================================================================

/// propose_admin_transfer() must not change get_admin() — only
/// accept_admin_transfer() does.
#[test]
fn test_propose_does_not_change_admin() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);

    assert_eq!(client.get_pending_admin(), None);

    client.propose_admin_transfer(&admin, &new_admin);

    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin));
}

/// The full propose -> accept happy path rotates Admin and clears
/// PendingAdmin, emitting both events (verified indirectly via the shared
/// EventSequence counter, matching the existing event-sequence test
/// pattern in this file).
#[test]
fn test_propose_then_accept_rotates_admin() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);

    client.propose_admin_transfer(&admin, &new_admin);
    assert_eq!(client.get_event_sequence(), 1);

    client.accept_admin_transfer(&new_admin);
    assert_eq!(client.get_event_sequence(), 2);

    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None);
}

/// Only the address currently in PendingAdmin may accept — anyone else,
/// including the current admin itself, gets NotPendingAdmin.
#[test]
fn test_accept_by_non_pending_address_fails() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.propose_admin_transfer(&admin, &new_admin);

    let result = client.try_accept_admin_transfer(&stranger);
    assert_eq!(result, Err(Ok(ContractError::NotPendingAdmin)));

    // The current admin trying to "accept" its own proposal isn't the
    // pending address either.
    let result = client.try_accept_admin_transfer(&admin);
    assert_eq!(result, Err(Ok(ContractError::NotPendingAdmin)));

    // Admin is unchanged after both rejected attempts.
    assert_eq!(client.get_admin(), admin);
}

/// Accepting with no proposal outstanding returns NoPendingAdmin.
#[test]
fn test_accept_with_no_pending_proposal_fails() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let stranger = Address::generate(&env);

    let result = client.try_accept_admin_transfer(&stranger);
    assert_eq!(result, Err(Ok(ContractError::NoPendingAdmin)));
}

/// cancel_admin_transfer() clears PendingAdmin; a subsequent accept then
/// fails with NoPendingAdmin, and Admin never changed.
#[test]
fn test_cancel_clears_pending_and_blocks_accept() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);

    client.propose_admin_transfer(&admin, &new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin.clone()));

    client.cancel_admin_transfer(&admin);
    assert_eq!(client.get_pending_admin(), None);

    let result = client.try_accept_admin_transfer(&new_admin);
    assert_eq!(result, Err(Ok(ContractError::NoPendingAdmin)));
    assert_eq!(client.get_admin(), admin);
}

/// Only the current admin may propose a transfer.
#[test]
fn test_propose_unauthorized() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);

    let result = client.try_propose_admin_transfer(&owner, &new_admin);
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));
    assert_eq!(client.get_pending_admin(), None);
}

/// Only the current admin may cancel — the proposed successor cannot
/// cancel its own pending transfer.
#[test]
fn test_cancel_unauthorized() {
    let (env, admin, retirement_tracker, _owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);

    client.propose_admin_transfer(&admin, &new_admin);

    let result = client.try_cancel_admin_transfer(&new_admin);
    assert_eq!(result, Err(Ok(ContractError::NotAuthorized)));

    // Proposal survives the rejected cancel attempt.
    assert_eq!(client.get_pending_admin(), Some(new_admin));
}

/// After a transfer is accepted, admin-gated functions (mint, set_status,
/// set_max_supply) must gate against the new admin and reject the old one.
#[test]
fn test_admin_gated_functions_follow_accepted_transfer() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let new_admin = Address::generate(&env);

    let meta = make_meta(&env);
    let token_id = client.mint(&admin, &owner, &meta);

    client.propose_admin_transfer(&admin, &new_admin);
    client.accept_admin_transfer(&new_admin);

    // Old admin is now rejected everywhere.
    assert_eq!(
        client.try_mint(&admin, &owner, &meta),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert_eq!(
        client.try_set_status(&admin, &token_id, &AssetStatus::Listed),
        Err(Ok(ContractError::NotAuthorized))
    );
    assert_eq!(
        client.try_set_max_supply(&admin, &100),
        Err(Ok(ContractError::NotAuthorized))
    );

    // New admin can now do everything the old admin used to.
    let second_token_id = client.mint(&new_admin, &owner, &meta);
    assert_eq!(second_token_id, 2);
    client.set_status(&new_admin, &token_id, &AssetStatus::Listed);
    assert_eq!(client.get_status(&token_id), AssetStatus::Listed);
    client.set_max_supply(&new_admin, &100);
    assert_eq!(client.get_max_supply(), Some(100));
}

// ====================================================================
// Compliance hook: cross-contract failure handling (issue #517)
// ====================================================================

#[contract]
pub struct MockRegulatoryCompliant;

#[contractimpl]
impl MockRegulatoryCompliant {
    pub fn validate_transaction(
        _env: Env,
        _from: Address,
        _to: Address,
        _operation: OperationType,
        _host_jurisdiction: String,
    ) -> ValidationResult {
        ValidationResult {
            is_compliant: true,
            rule_id: None,
            requires_authorization: false,
            authority_address: None,
            error_message: None,
        }
    }
}

#[contract]
pub struct MockRegulatoryNonCompliant;

#[contractimpl]
impl MockRegulatoryNonCompliant {
    pub fn validate_transaction(
        _env: Env,
        _from: Address,
        _to: Address,
        _operation: OperationType,
        _host_jurisdiction: String,
    ) -> ValidationResult {
        ValidationResult {
            is_compliant: false,
            rule_id: None,
            requires_authorization: false,
            authority_address: None,
            error_message: None,
        }
    }
}

/// Deliberately does not export `validate_transaction` — exercises the
/// "target contract missing the expected function" failure mode.
#[contract]
pub struct MockRegulatoryNoValidate;

#[contractimpl]
impl MockRegulatoryNoValidate {
    pub fn ping(_env: Env) -> bool {
        true
    }
}

/// Same name/args as the real hook, but returns a type that cannot
/// deserialize as ValidationResult — exercises the "malformed return
/// value" failure mode.
#[contract]
pub struct MockRegulatoryBadReturn;

#[contractimpl]
impl MockRegulatoryBadReturn {
    pub fn validate_transaction(
        _env: Env,
        _from: Address,
        _to: Address,
        _operation: OperationType,
        _host_jurisdiction: String,
    ) -> u32 {
        42
    }
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum MockRegulatoryError {
    Denied = 1,
}

/// Always returns its own typed error — exercises the "target function
/// itself returns an error" failure mode.
#[contract]
pub struct MockRegulatoryErroring;

#[contractimpl]
impl MockRegulatoryErroring {
    pub fn validate_transaction(
        _env: Env,
        _from: Address,
        _to: Address,
        _operation: OperationType,
        _host_jurisdiction: String,
    ) -> Result<ValidationResult, MockRegulatoryError> {
        Err(MockRegulatoryError::Denied)
    }
}

/// Mints a token to `owner` and returns its id, on a contract that
/// already has `regulatory_contract` wired in via set_regulatory_check.
fn mint_with_regulatory(
    env: &Env,
    client: &CarbonAssetClient,
    admin: &Address,
    owner: &Address,
    regulatory_contract: &Address,
) -> u32 {
    client.set_regulatory_check(admin, regulatory_contract);
    client.mint(admin, owner, &make_meta(env))
}

/// Fail-open is a deliberate design choice, not an oversight: a
/// deployment that never configures a regulatory contract hasn't opted
/// into compliance gating, so transfers proceed normally. Locks in this
/// behavior against an accidental future change to fail-closed.
#[test]
fn test_before_transfer_without_regulatory_contract_is_fail_open() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);

    let token_id = client.mint(&admin, &owner, &make_meta(&env));
    let buyer = Address::generate(&env);

    client.transfer(&owner, &buyer, &1);
    assert_eq!(client.owner_of(&token_id), buyer);
}

/// No behavior change for the healthy path: a compliant regulatory
/// contract still allows the transfer to proceed exactly as before.
#[test]
fn test_transfer_with_compliant_regulatory_contract_succeeds() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let regulatory_id = env.register(MockRegulatoryCompliant, ());

    let token_id = mint_with_regulatory(&env, &client, &admin, &owner, &regulatory_id);
    let buyer = Address::generate(&env);

    client.transfer(&owner, &buyer, &1);
    assert_eq!(client.owner_of(&token_id), buyer);
}

/// A regulatory contract that responds non-compliant is a distinct,
/// successful call — ComplianceFailed, not ComplianceCallFailed.
#[test]
fn test_transfer_with_noncompliant_regulatory_contract_returns_compliance_failed() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let regulatory_id = env.register(MockRegulatoryNonCompliant, ());

    mint_with_regulatory(&env, &client, &admin, &owner, &regulatory_id);
    let buyer = Address::generate(&env);

    let result = client.try_transfer(&owner, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::ComplianceFailed)));
}

/// Target contract not deployed at all.
#[test]
fn test_transfer_with_undeployed_regulatory_contract_returns_compliance_call_failed() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    // Never registered as a contract — just a bare address.
    let regulatory_id = Address::generate(&env);

    mint_with_regulatory(&env, &client, &admin, &owner, &regulatory_id);
    let buyer = Address::generate(&env);

    let result = client.try_transfer(&owner, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::ComplianceCallFailed)));
}

/// Target contract deployed but missing validate_transaction.
#[test]
fn test_transfer_with_regulatory_contract_missing_function_returns_compliance_call_failed() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let regulatory_id = env.register(MockRegulatoryNoValidate, ());

    mint_with_regulatory(&env, &client, &admin, &owner, &regulatory_id);
    let buyer = Address::generate(&env);

    let result = client.try_transfer(&owner, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::ComplianceCallFailed)));
}

/// Target contract's return value doesn't deserialize as ValidationResult.
#[test]
fn test_transfer_with_regulatory_contract_malformed_return_returns_compliance_call_failed() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let regulatory_id = env.register(MockRegulatoryBadReturn, ());

    mint_with_regulatory(&env, &client, &admin, &owner, &regulatory_id);
    let buyer = Address::generate(&env);

    let result = client.try_transfer(&owner, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::ComplianceCallFailed)));
}

/// Target function itself returns its own typed error.
#[test]
fn test_transfer_with_regulatory_contract_erroring_returns_compliance_call_failed() {
    let (env, admin, retirement_tracker, owner) = setup_env();
    let (_id, client) = setup_client(&env, &admin, &retirement_tracker);
    let regulatory_id = env.register(MockRegulatoryErroring, ());

    mint_with_regulatory(&env, &client, &admin, &owner, &regulatory_id);
    let buyer = Address::generate(&env);

    let result = client.try_transfer(&owner, &buyer, &1);
    assert_eq!(result, Err(Ok(ContractError::ComplianceCallFailed)));
}
