#![cfg(test)]
use soroban_sdk::{testutils::Address as _, testutils::Ledger as _, Address, BytesN, Env, String, Vec};
use tax_attribute::{AttributeDefinition, TaxAttributeContract, TaxAttributeContractClient};

fn setup_test_env() -> (Env, TaxAttributeContractClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TaxAttributeContract);
    let client = TaxAttributeContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.init(&admin);
    client.add_issuer(&issuer);

    (env, client, admin, issuer)
}

fn setup_ledger(env: &Env, sequence_number: u32) {
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: 1000,
        protocol_version: 23,
        sequence_number,
        network_id: [0u8; 32],
        base_reserve: 0,
        max_entry_ttl: 100,
        min_persistent_entry_ttl: 10,
        min_temp_entry_ttl: 5,
    });
}

fn create_definition(
    env: &Env,
    tag_id: &str,
    valid_from: u64,
    valid_until: u64,
) -> AttributeDefinition {
    AttributeDefinition {
        tag_id: String::from_str(env, tag_id),
        jurisdiction: String::from_str(env, "US"),
        regulation_code: String::from_str(env, "SEC-REG-D"),
        eligibility_criteria_hash: BytesN::from_array(env, &[0u8; 32]),
        valid_from,
        valid_until,
    }
}

#[test]
fn test_attach_valid_current_attribute_succeeds() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 1);

    let definition = create_definition(&env, "tag-1", 500, 2000);
    client.attach_tax_attribute(&issuer, &1, &definition);

    let attached = client.get_attributes_for_token(&1);
    assert_eq!(attached.len(), 1);
    assert_eq!(attached.get(0).unwrap().tag_id, String::from_str(&env, "tag-1"));
}

#[test]
fn test_attach_future_attribute_succeeds() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 1);

    let definition = create_definition(&env, "tag-future", 1500, 3000);
    client.attach_tax_attribute(&issuer, &1, &definition);

    let active_attributes = client.get_attributes_for_token(&1);
    assert_eq!(active_attributes.len(), 0);
}

#[test]
#[should_panic(expected = "Cannot attach an expired attribute")]
fn test_attach_expired_attribute_fails() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 1);

    let definition = create_definition(&env, "tag-expired", 100, 900);
    client.attach_tax_attribute(&issuer, &1, &definition);
}

#[test]
fn test_attach_exactly_at_expiration_boundary_succeeds() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 1);

    let definition = create_definition(&env, "tag-edge", 500, 1000);
    client.attach_tax_attribute(&issuer, &1, &definition);

    let attached = client.get_attributes_for_token(&1);
    assert_eq!(attached.len(), 1);
}

#[test]
fn test_generate_issuer_proof_for_authorized_issuer() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 5);

    let proof = client.generate_issuer_proof(&issuer);
    assert_eq!(proof.issuer, issuer);
    assert!(proof.is_authorized);
    assert_eq!(proof.ledger_sequence, 5);
}

#[test]
fn test_generate_issuer_proof_for_unauthorized_issuer() {
    let (env, client, _admin, _issuer) = setup_test_env();
    setup_ledger(&env, 5);

    let unauthorized_issuer = Address::generate(&env);
    let proof = client.generate_issuer_proof(&unauthorized_issuer);
    assert_eq!(proof.issuer, unauthorized_issuer);
    assert!(!proof.is_authorized);
    assert_eq!(proof.ledger_sequence, 5);
}

#[test]
fn test_verify_issuer_proof_valid() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 5);

    let proof = client.generate_issuer_proof(&issuer);
    let is_valid = client.verify_issuer_proof(&proof);
    assert!(is_valid);
}

#[test]
fn test_verify_issuer_proof_invalid_after_removal() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 5);

    let proof = client.generate_issuer_proof(&issuer);
    assert!(proof.is_authorized);

    // Remove the issuer
    client.remove_issuer(&issuer);

    // Verification should fail since the state changed
    let is_valid = client.verify_issuer_proof(&proof);
    assert!(!is_valid);
}

#[test]
fn test_generate_batch_issuer_proofs() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 5);

    let unauthorized_issuer = Address::generate(&env);
    let mut issuers = Vec::new(&env);
    issuers.push_back(issuer.clone());
    issuers.push_back(unauthorized_issuer.clone());

    let proofs = client.generate_batch_issuer_proofs(&issuers);
    assert_eq!(proofs.len(), 2);

    // First issuer should be authorized
    assert_eq!(proofs.get(0).unwrap().issuer, issuer);
    assert!(proofs.get(0).unwrap().is_authorized);

    // Second issuer should not be authorized
    assert_eq!(proofs.get(1).unwrap().issuer, unauthorized_issuer);
    assert!(!proofs.get(1).unwrap().is_authorized);
}

#[test]
fn test_proof_determinism_same_state() {
    let (env, client, _admin, issuer) = setup_test_env();
    setup_ledger(&env, 5);

    let proof1 = client.generate_issuer_proof(&issuer);
    let proof2 = client.generate_issuer_proof(&issuer);

    // Same state should produce same proof
    assert_eq!(proof1.issuer, proof2.issuer);
    assert_eq!(proof1.is_authorized, proof2.is_authorized);
    assert_eq!(proof1.ledger_sequence, proof2.ledger_sequence);
    assert_eq!(proof1.proof_hash, proof2.proof_hash);
}

#[test]
fn test_proof_changes_with_ledger_sequence() {
    let (env, client, _admin, issuer) = setup_test_env();
    
    setup_ledger(&env, 5);

    let proof1 = client.generate_issuer_proof(&issuer);

    setup_ledger(&env, 6);

    let proof2 = client.generate_issuer_proof(&issuer);

    // Different ledger sequence should produce different proof
    assert_ne!(proof1.ledger_sequence, proof2.ledger_sequence);
    assert_ne!(proof1.proof_hash, proof2.proof_hash);
}