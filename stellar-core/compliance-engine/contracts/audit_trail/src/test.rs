#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Ledger;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Set up a contract, initialise it, and authorize `emitter`.
/// Returns `(env, client, admin, emitter)`.
fn setup() -> (
    Env,
    AuditTrailContractClient<'static>,
    Address,
    Address,
) {
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();
    client.authorize_emitter(&emitter);

    (env, client, admin, emitter)
}

// ---------------------------------------------------------------------------
// Existing tests (updated for new record_event signature)
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_and_auth() {
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();

    client.authorize_emitter(&emitter);
    assert!(client.is_authorized(&emitter));

    client.revoke_emitter(&emitter);
    assert!(!client.is_authorized(&emitter));
}

#[test]
fn test_record_and_query_event() {
    let (env, client, _admin, emitter) = setup();

    let event_type = String::from_str(&env, "TOKEN_MINTED");
    let primary_id = String::from_str(&env, "project-123");
    let event_data = String::from_str(&env, "{\"amount\": 100}");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    let event_id = client.record_event(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    // The stored event must carry the caller's address in emitting_contract.
    let stored_event = client.get_event(&event_id).unwrap();
    assert_eq!(stored_event.event_type, event_type);
    assert_eq!(stored_event.primary_entity_id, primary_id);
    assert_eq!(
        stored_event.emitting_contract, emitter,
        "emitting_contract must equal the authenticated caller"
    );

    let entity_events = client.get_events_by_entity(&primary_id);
    assert_eq!(entity_events.len(), 1);
    assert_eq!(entity_events.get(0).unwrap().event_id, event_id);

    let contract_events = client.get_events_by_contract(&emitter);
    assert_eq!(contract_events.len(), 1);

    let timestamp = env.ledger().timestamp();
    let time_events = client.get_events_by_type_and_time(&event_type, &timestamp);
    assert_eq!(time_events.len(), 1);
}

#[test]
#[should_panic(expected = "Event payload exceeds maximum allowed size")]
fn test_oversized_event_payload() {
    let (env, client, _admin, emitter) = setup();

    let event_type = String::from_str(&env, "BIG_EVENT");
    let primary_id = String::from_str(&env, "big-entity");
    let oversized = "A".repeat(crate::MAX_EVENT_PAYLOAD_SIZE as usize + 1);
    let event_data = String::from_str(&env, &oversized);
    let tx_hash = BytesN::from_array(&env, &[1; 32]);

    client.record_event(&emitter, &event_type, &primary_id, &None, &event_data, &tx_hash);
}

#[test]
#[should_panic(expected = "Caller not authorized")]
fn test_unauthorized_emitter() {
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    env.mock_all_auths();

    // This address was never added to the authorized-emitters list.
    let unauthorized = Address::generate(&env);

    let event_type = String::from_str(&env, "TOKEN_MINTED");
    let primary_id = String::from_str(&env, "project-123");
    let event_data = String::from_str(&env, "{}");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    client.record_event(
        &unauthorized,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );
}

#[test]
fn test_retention_period_configuration() {
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    env.mock_all_auths();

    assert_eq!(client.get_retention_period(), 90 * 86400);

    client.set_retention_period(&(30 * 86400));
    assert_eq!(client.get_retention_period(), 30 * 86400);
}

#[test]
#[should_panic]
fn test_unauthorized_set_retention_period() {
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.set_retention_period(&(30 * 86400));
}

#[test]
fn test_pruning_and_compaction() {
    let (env, client, _admin, emitter) = setup();

    client.set_retention_period(&86400);

    let event_type = String::from_str(&env, "TEST_EVENT");
    let primary_id = String::from_str(&env, "entity-1");
    let event_data = String::from_str(&env, "data");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    env.ledger().set_timestamp(0);
    let event_id_1 = client.record_event(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    env.ledger().set_timestamp(172800);
    let event_id_2 = client.record_event(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    assert_eq!(client.get_event_count(), 2);
    let bytes_before = client.get_total_storage_bytes();
    assert!(bytes_before > 0);

    env.ledger().set_timestamp(172801);

    let pruned = client.prune_old_events();
    assert_eq!(pruned, 1);

    assert_eq!(client.get_event_count(), 1);
    let bytes_after = client.get_total_storage_bytes();
    assert!(bytes_after < bytes_before);

    assert!(client.get_event(&event_id_1).is_none());
    assert!(client.get_event(&event_id_2).is_some());

    let entity_events = client.get_events_by_entity(&primary_id);
    assert_eq!(entity_events.len(), 1);
    assert_eq!(entity_events.get(0).unwrap().event_id, event_id_2);
}

// ---------------------------------------------------------------------------
// NEW: Caller provenance / spoofing-prevention tests
// ---------------------------------------------------------------------------

/// Verify that `emitting_contract` stored in the event matches the address
/// used in the call.  Because `caller.require_auth()` is enforced, a contract
/// cannot pass a foreign address — the host would revert.  Under `mock_all_auths`
/// we confirm the happy path: authorized caller records under its own address.
#[test]
fn test_emitting_contract_reflects_actual_caller() {
    let (env, client, _admin, authorized_a) = setup();

    // Authorize a second contract.
    let authorized_b = Address::generate(&env);
    client.authorize_emitter(&authorized_b);

    let event_type = String::from_str(&env, "TRANSFER");
    let primary_id = String::from_str(&env, "entity-a");
    let event_data = String::from_str(&env, "{}");
    let tx_hash = BytesN::from_array(&env, &[2; 32]);

    // authorized_a records an event under its own address.
    let event_id = client.record_event(
        &authorized_a,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    let stored = client.get_event(&event_id).unwrap();
    assert_eq!(
        stored.emitting_contract, authorized_a,
        "emitting_contract must match the authorized caller passed in"
    );
    assert_ne!(
        stored.emitting_contract, authorized_b,
        "emitting_contract must NOT be a different authorized contract"
    );
}

/// Passing an unauthorized address (never added to the allowlist) must be
/// rejected with "Caller not authorized", regardless of what address is passed.
///
/// This verifies that the allowlist check prevents a non-member from recording
/// events even when they control the key for the address they provide.
#[test]
#[should_panic(expected = "Caller not authorized")]
fn test_spoofing_unauthorized_address_is_rejected() {
    let (env, client, _admin, _authorized) = setup();

    // `attacker` was never authorized — call must fail immediately.
    let attacker = Address::generate(&env);

    let event_type = String::from_str(&env, "FAKE_EVENT");
    let primary_id = String::from_str(&env, "victim-contract");
    let event_data = String::from_str(&env, "{\"spoofed\": true}");
    let tx_hash = BytesN::from_array(&env, &[3; 32]);

    client.record_event(
        &attacker,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );
}

/// A revoked emitter must not be able to record events after revocation.
#[test]
#[should_panic(expected = "Caller not authorized")]
fn test_revoked_emitter_cannot_record_events() {
    let (env, client, _admin, emitter) = setup();

    // Revoke the previously-authorized emitter.
    client.revoke_emitter(&emitter);

    let event_type = String::from_str(&env, "SHOULD_FAIL");
    let primary_id = String::from_str(&env, "entity-x");
    let event_data = String::from_str(&env, "{}");
    let tx_hash = BytesN::from_array(&env, &[4; 32]);

    client.record_event(&emitter, &event_type, &primary_id, &None, &event_data, &tx_hash);
}

/// Two independently authorized contracts can each record events, and each
/// event's `emitting_contract` correctly identifies the respective caller.
#[test]
fn test_two_authorized_callers_produce_independent_records() {
    let (env, client, _admin, emitter_a) = setup();

    let emitter_b = Address::generate(&env);
    client.authorize_emitter(&emitter_b);

    let event_type = String::from_str(&env, "MINT");
    let primary_id = String::from_str(&env, "shared-entity");
    let event_data = String::from_str(&env, "{}");

    // emitter_a records an event.
    let tx_hash_a = BytesN::from_array(&env, &[5; 32]);
    let event_id_a = client.record_event(
        &emitter_a,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash_a,
    );

    // emitter_b records an event at a slightly later timestamp.
    env.ledger().set_timestamp(env.ledger().timestamp() + 1);
    let tx_hash_b = BytesN::from_array(&env, &[6; 32]);
    let event_id_b = client.record_event(
        &emitter_b,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash_b,
    );

    let stored_a = client.get_event(&event_id_a).unwrap();
    let stored_b = client.get_event(&event_id_b).unwrap();

    assert_eq!(stored_a.emitting_contract, emitter_a);
    assert_eq!(stored_b.emitting_contract, emitter_b);

    // Both events appear in the shared entity index.
    let entity_events = client.get_events_by_entity(&primary_id);
    assert_eq!(entity_events.len(), 2);

    // Each contract index contains only its own events.
    assert_eq!(client.get_events_by_contract(&emitter_a).len(), 1);
    assert_eq!(client.get_events_by_contract(&emitter_b).len(), 1);
}

/// An authorized contract cannot record an event attributed to a *different*
/// authorized contract.  Passing contract B's address when contract A should
/// be the caller violates the require_auth check.
///
/// Note: under `mock_all_auths` this test uses a separate auth scope to verify
/// that the allowlist check runs before auth, and that passing any address that
/// is NOT in the allowlist is rejected.  The case where an *authorized* address
/// tries to use another *authorized* address would be caught by require_auth on
/// the host.  We test the un-authorized variant here to verify the allowlist
/// itself prevents cross-identity writes.
#[test]
#[should_panic(expected = "Caller not authorized")]
fn test_cannot_record_events_using_another_contracts_identity() {
    let (env, client, _admin, _emitter_a) = setup();

    // emitter_b is also authorized.
    let emitter_b = Address::generate(&env);
    client.authorize_emitter(&emitter_b);

    // A completely unauthorized address tries to record an event claiming to
    // be emitter_b.  The allowlist check sees the unauthorized address, emits
    // a provenance failure event, and panics.
    let unauthorized = Address::generate(&env);

    let event_type = String::from_str(&env, "IMPERSONATE");
    let primary_id = String::from_str(&env, "target");
    let event_data = String::from_str(&env, "{}");
    let tx_hash = BytesN::from_array(&env, &[7; 32]);

    client.record_event(
        &unauthorized,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );
}

/// Verify that `get_events_by_entity_paged` returns correct pages.
#[test]
fn test_paged_query() {
    let (env, client, _admin, emitter) = setup();

    let event_type = String::from_str(&env, "PAGE_TEST");
    let primary_id = String::from_str(&env, "paged-entity");
    let event_data = String::from_str(&env, "{}");

    for i in 0u8..5 {
        let tx_hash = BytesN::from_array(&env, &[i; 32]);
        env.ledger().set_timestamp(env.ledger().timestamp() + 1);
        client.record_event(&emitter, &event_type, &primary_id, &None, &event_data, &tx_hash);
    }

    // Page 0: first 3 events.
    let page0 = client.get_events_by_entity_paged(&primary_id, &0, &3);
    assert_eq!(page0.len(), 3);

    // Page 1: next 2 events.
    let page1 = client.get_events_by_entity_paged(&primary_id, &3, &3);
    assert_eq!(page1.len(), 2);

    // Beyond the end returns empty.
    let page2 = client.get_events_by_entity_paged(&primary_id, &10, &3);
    assert_eq!(page2.len(), 0);
}
