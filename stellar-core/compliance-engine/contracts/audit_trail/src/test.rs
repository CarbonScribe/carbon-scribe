#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Ledger;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

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
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();
    client.authorize_emitter(&emitter);

    let event_type = String::from_str(&env, "TOKEN_MINTED");
    let primary_id = String::from_str(&env, "project-123");
    let event_data = String::from_str(&env, "{\"amount\": 100}");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    let event_id = client.record_event_auth(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    let stored_event = client.get_event(&event_id).unwrap();
    assert_eq!(stored_event.event_type, event_type);
    assert_eq!(stored_event.primary_entity_id, primary_id);

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
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();
    client.authorize_emitter(&emitter);

    let event_type = String::from_str(&env, "BIG_EVENT");
    let primary_id = String::from_str(&env, "big-entity");
    let oversized = "A".repeat(crate::MAX_EVENT_PAYLOAD_SIZE as usize + 1);
    let event_data = String::from_str(&env, &oversized);
    let tx_hash = BytesN::from_array(&env, &[1; 32]);

    client.record_event_auth(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );
}

#[test]
#[should_panic(expected = "Emitter not authorized")]
fn test_unauthorized_emitter() {
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();

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
    let env = Env::default();
    let contract_id = env.register(AuditTrailContract, ());
    let client = AuditTrailContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let emitter = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();
    client.authorize_emitter(&emitter);

    client.set_retention_period(&86400);

    let event_type = String::from_str(&env, "TEST_EVENT");
    let primary_id = String::from_str(&env, "entity-1");
    let event_data = String::from_str(&env, "data");
    let tx_hash = BytesN::from_array(&env, &[0; 32]);

    env.ledger().set_timestamp(0);
    let event_id_1 = client.record_event_auth(
        &emitter,
        &event_type,
        &primary_id,
        &None,
        &event_data,
        &tx_hash,
    );

    env.ledger().set_timestamp(172800);
    let event_id_2 = client.record_event_auth(
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
