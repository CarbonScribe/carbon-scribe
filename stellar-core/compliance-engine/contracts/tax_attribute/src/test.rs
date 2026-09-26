#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, BytesN, Env, String};

fn make_attribute_def(env: &Env, tag_id: &str, valid_until: u64) -> AttributeDefinition {
    AttributeDefinition {
        tag_id: String::from_str(env, tag_id),
        jurisdiction: String::from_str(env, "US"),
        regulation_code: String::from_str(env, "IRC-45Q"),
        eligibility_criteria_hash: BytesN::from_array(env, &[1u8; 32]),
        valid_from: 0,
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

    let def = make_attribute_def(&env, "TAG-001", 1000);
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

    let def = make_attribute_def(&env, "TAG-001", 1000); // valid_until = 1000 < 2000
    let res = client.try_attach_tax_attribute(&issuer, &1u32, &def);
    assert!(matches!(res, Err(Ok(ContractError::AttributeExpired))));
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

    let def = make_attribute_def(&env, "TAG-001", 1000);
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
    let res = client.try_revoke_attribute(&admin, &1u32, &tag_id);
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
    let def = make_attribute_def(&env, "TAG-001", 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    // Rando attempts revocation
    let tag_id = String::from_str(&env, "TAG-001");
    let res = client.try_revoke_attribute(&rando, &1u32, &tag_id);
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
    let def = make_attribute_def(&env, "TAG-001", 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    // Attempt to revoke from token 2 where it wasn't attached
    let tag_id = String::from_str(&env, "TAG-001");
    let res = client.try_revoke_attribute(&issuer, &2u32, &tag_id);
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
    let def = make_attribute_def(&env, "TAG-001", 1000);
    client.attach_tax_attribute(&issuer, &1u32, &def);

    let jur = String::from_str(&env, "US");
    let reg = String::from_str(&env, "IRC-45Q");
    assert_eq!(client.is_token_eligible(&1u32, &jur, &reg), true);

    let tag_id = String::from_str(&env, "TAG-001");
    client.revoke_attribute(&issuer, &1u32, &tag_id);
    assert_eq!(client.is_token_eligible(&1u32, &jur, &reg), false);
}
