#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _, testutils::Events as _, testutils::Ledger as _, Address, BytesN, Env,
    Map, String, Symbol, TryFromVal, Val,
};

/// Decodes the most recently published `AttributeRevokedEvent` off
/// `env.events()`, returning its fields for assertion.
fn last_attribute_revoked_event(env: &Env) -> (u32, String, Address, String, u64) {
    let events = env.events().all();
    let (_, topics, data) = events.get(events.len() - 1).unwrap();

    let expected_symbol = Symbol::new(env, "attribute_revoked_event");
    assert_eq!(topics.len(), 1, "AttributeRevokedEvent should have 1 topic");
    assert_eq!(
        Symbol::try_from_val(env, &topics.get(0).unwrap()),
        Ok(expected_symbol)
    );

    let map: Map<Symbol, Val> = Map::try_from_val(env, &data).unwrap();
    let token_id: u32 =
        u32::try_from_val(env, &map.get(Symbol::new(env, "token_id")).unwrap()).unwrap();
    let tag_id: String =
        String::try_from_val(env, &map.get(Symbol::new(env, "tag_id")).unwrap()).unwrap();
    let revoked_by: Address =
        Address::try_from_val(env, &map.get(Symbol::new(env, "revoked_by")).unwrap()).unwrap();
    let reason: String =
        String::try_from_val(env, &map.get(Symbol::new(env, "reason")).unwrap()).unwrap();
    let timestamp: u64 =
        u64::try_from_val(env, &map.get(Symbol::new(env, "timestamp")).unwrap()).unwrap();

    (token_id, tag_id, revoked_by, reason, timestamp)
}

fn make_attribute_def(env: &Env, tag_id: &str, valid_from: u64, valid_until: u64) -> AttributeDefinition {
    AttributeDefinition {
        tag_id: String::from_str(env, tag_id),
        jurisdiction: String::from_str(env, "US"),
        regulation_code: String::from_str(env, "IRC-45Q"),
        eligibility_criteria_hash: BytesN::from_array(env, &[1u8; 32]),
        valid_from,
        valid_until,
    }
}

#[test]
fn test_init_and_reinitialization_guard() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    assert_eq!(client.is_initialized(), false);

    client.init(&admin);
    assert_eq!(client.is_initialized(), true);

    let attacker = Address::generate(&env);
    let res = client.try_init(&attacker);
    assert!(matches!(res, Err(Ok(ContractError::AlreadyInitialized))));
}

#[test]
fn test_unauthorized_issuer_attachment() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let unauthorized_issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();

    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    let res = client.try_attach_tax_attribute(&unauthorized_issuer, &1u32, &def);
    assert!(matches!(res, Err(Ok(ContractError::NotAuthorizedIssuer))));
}

#[test]
fn test_expired_attribute_attachment() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    // Set ledger timestamp past valid_until
    env.ledger().set_timestamp(2000);

    let def = make_attribute_def(&env, "TAG-001", 0, 1000); // valid_until = 1000 < 2000
    let res = client.try_attach_tax_attribute(&issuer, &1u32, &def);
    assert!(matches!(res, Err(Ok(ContractError::AttributeExpired))));
}

#[test]
fn test_inverted_validity_window_rejection() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);

    // Create attribute with inverted window: valid_from > valid_until
    let def = make_attribute_def(&env, "TAG-001", 2000, 1000); // valid_from = 2000 > valid_until = 1000
    let res = client.try_attach_tax_attribute(&issuer, &1u32, &def);
    assert!(matches!(res, Err(Ok(ContractError::InvalidValidityWindow))));

    // Verify the attribute was not stored
    let tag_id = String::from_str(&env, "TAG-001");
    let stored_attr = client.try_get_attribute(&tag_id);
    assert!(matches!(stored_attr, Err(Ok(ContractError::AttributeNotFound))));
}

#[test]
fn test_duplicate_tag_id_attachment() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);

    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    // Attempt attaching again with same tag_id
    let res = client.try_attach_tax_attribute(&issuer, &2u32, &def);
    assert!(matches!(res, Err(Ok(ContractError::AttributeAlreadyExists))));
}

#[test]
fn test_revoke_attribute_not_found() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();

    let tag_id = String::from_str(&env, "NON-EXISTENT");
    let reason = String::from_str(&env, "cleanup");
    let res = client.try_revoke_attribute(&admin, &1u32, &tag_id, &reason);
    assert!(matches!(res, Err(Ok(ContractError::AttributeNotFound))));
}

#[test]
fn test_revoke_attribute_unauthorized() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let rando = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);
    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    // Rando attempts revocation
    let tag_id = String::from_str(&env, "TAG-001");
    let reason = String::from_str(&env, "malicious attempt");
    let res = client.try_revoke_attribute(&rando, &1u32, &tag_id, &reason);
    assert!(matches!(res, Err(Ok(ContractError::NotAuthorized))));
}

#[test]
fn test_revoke_attribute_not_attached() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);
    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    // Attempt to revoke from token 2 where it wasn't attached
    let tag_id = String::from_str(&env, "TAG-001");
    let reason = String::from_str(&env, "wrong token");
    let res = client.try_revoke_attribute(&issuer, &2u32, &tag_id, &reason);
    assert!(matches!(res, Err(Ok(ContractError::AttributeNotAttached))));
}

#[test]
fn test_happy_path_lifecycle() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);
    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    let jur = String::from_str(&env, "US");
    let reg = String::from_str(&env, "IRC-45Q");
    assert_eq!(client.is_token_eligible(&1u32, &jur, &reg), true);

    let tag_id = String::from_str(&env, "TAG-001");
    let reason = String::from_str(&env, "regulatory change");
    client.revoke_attribute(&issuer, &1u32, &tag_id, &reason);
    assert_eq!(client.is_token_eligible(&1u32, &jur, &reg), false);
}

#[test]
fn test_revoke_attribute_emits_event_for_admin_caller() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);
    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    env.ledger().set_timestamp(700);
    let tag_id = String::from_str(&env, "TAG-001");
    let reason = String::from_str(&env, "regulatory change");
    // The admin (not the original issuing authority) revokes.
    client.revoke_attribute(&admin, &1u32, &tag_id, &reason);

    let (token_id, event_tag_id, revoked_by, event_reason, timestamp) =
        last_attribute_revoked_event(&env);
    assert_eq!(token_id, 1u32);
    assert_eq!(event_tag_id, tag_id);
    assert_eq!(revoked_by, admin);
    assert_eq!(event_reason, reason);
    assert_eq!(timestamp, 700);
}

#[test]
fn test_revoke_attribute_emits_event_for_issuer_caller() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);
    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    env.ledger().set_timestamp(900);
    let tag_id = String::from_str(&env, "TAG-001");
    let reason = String::from_str(&env, "issuer error");
    // The original issuing authority revokes.
    client.revoke_attribute(&issuer, &1u32, &tag_id, &reason);

    let (token_id, event_tag_id, revoked_by, event_reason, timestamp) =
        last_attribute_revoked_event(&env);
    assert_eq!(token_id, 1u32);
    assert_eq!(event_tag_id, tag_id);
    assert_eq!(revoked_by, issuer);
    assert_eq!(event_reason, reason);
    assert_eq!(timestamp, 900);
}

#[test]
fn test_revoke_attribute_failure_paths_emit_no_event() {
    let env = Env::default();
    let contract_id = env.register(TaxAttributeContract, ());
    let client = TaxAttributeContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let rando = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.add_issuer(&issuer);

    env.ledger().set_timestamp(500);
    let def = make_attribute_def(&env, "TAG-001", 0, 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    let tag_id = String::from_str(&env, "TAG-001");
    let reason = String::from_str(&env, "malicious attempt");
    let res = client.try_revoke_attribute(&rando, &1u32, &tag_id, &reason);
    assert!(matches!(res, Err(Ok(ContractError::NotAuthorized))));

    // No AttributeRevokedEvent should have been published on the failed path.
    let expected_symbol = Symbol::new(&env, "attribute_revoked_event");
    for i in 0..env.events().all().len() {
        let (_, topics, _) = env.events().all().get(i).unwrap();
        if let Some(t) = topics.get(0) {
            assert_ne!(Symbol::try_from_val(&env, &t), Ok(expected_symbol.clone()));
        }
    }
}
