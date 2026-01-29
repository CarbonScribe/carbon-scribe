#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

#[test]
fn test_initialize_and_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AuditTrailContract);
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);

    // Verify admin set (indirectly via auth check)
    env.mock_all_auths();
    
    // Authorize emitter
    client.authorize_emitter(&emitter);
    
    assert!(client.is_authorized(&emitter));
    
    // Revoke emitter
    client.revoke_emitter(&emitter);
    assert!(!client.is_authorized(&emitter));
}

#[test]
fn test_record_and_query_event() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AuditTrailContract);
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();
    client.authorize_emitter(&emitter);

    // Setup dummy data
    let event_type = String::from_str(&env, "TOKEN_MINTED");
    let primary_id = String::from_str(&env, "project-123");
    let event_data = String::from_str(&env, "{\"amount\": 100}");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    // Record event
    let event_id = client.record_event_auth(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    // Verify event storage
    let stored_event = client.get_event(&event_id).unwrap();
    assert_eq!(stored_event.event_type, event_type);
    assert_eq!(stored_event.primary_entity_id, primary_id);

    // Test Query by Entity
    let entity_events = client.get_events_by_entity(&primary_id);
    assert_eq!(entity_events.len(), 1);
    assert_eq!(entity_events.get(0).unwrap().event_id, event_id);

    // Test Query by Contract
    let contract_events = client.get_events_by_contract(&emitter);
    assert_eq!(contract_events.len(), 1);

    // Test Query by Type/Time
    let timestamp = env.ledger().timestamp();
    let time_events = client.get_events_by_type_and_time(&event_type, &timestamp);
    assert_eq!(time_events.len(), 1);
}

#[test]
#[should_panic(expected = "Emitter not authorized")]
fn test_unauthorized_emitter() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AuditTrailContract);
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();
    
    // Emitter not authorized yet
    let event_type = String::from_str(&env, "TOKEN_MINTED");
    let primary_id = String::from_str(&env, "project-123");
    let event_data = String::from_str(&env, "{}");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    client.record_event_auth(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );
}
