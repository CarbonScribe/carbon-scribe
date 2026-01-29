#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};

use crate::types::Error;
use crate::validation::validate_ipfs_cid;
use crate::{ProjectRegistry, ProjectRegistryClient};

fn create_contract() -> (Env, Address, ProjectRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProjectRegistry, ());
    let client = ProjectRegistryClient::new(&env, &contract_id);

    (env, contract_id, client)
}

// ========== Contract Tests ==========

#[test]
fn test_initialization() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let stored_admin = client.get_admin();
    assert_eq!(stored_admin, admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialization() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);

    client.initialize(&admin);
    client.initialize(&admin); // Should panic
}

#[test]
fn test_register_project() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    let owner = client.get_project_owner(&project_id);
    assert_eq!(owner, project_owner);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_register_duplicate_project() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);
    client.register_project(&project_id, &project_owner); // Should panic
}

#[test]
fn test_transfer_project_ownership() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let original_owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");

    client.initialize(&admin);
    client.register_project(&project_id, &original_owner);

    client.transfer_project_ownership(&project_id, &new_owner);

    let owner = client.get_project_owner(&project_id);
    assert_eq!(owner, new_owner);
}

#[test]
fn test_anchor_document() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    let version_index = client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    assert_eq!(version_index, 0);

    let latest_cid = client.get_latest_cid(&project_id);
    assert_eq!(latest_cid, ipfs_cid);
}

#[test]
fn test_anchor_document_multiple_versions() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let cid1 = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let cid2 = SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    let v1 = client.anchor_document(&project_id, &cid1, &doc_type);
    let v2 = client.anchor_document(&project_id, &cid2, &doc_type);

    assert_eq!(v1, 0);
    assert_eq!(v2, 1);

    let latest_cid = client.get_latest_cid(&project_id);
    assert_eq!(latest_cid, cid2);

    let history = client.get_document_history(&project_id);
    assert_eq!(history.len(), 2);
}

#[test]
fn test_anchor_document_batch() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");

    let mut documents = Vec::new(&env);
    documents.push_back((
        SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"),
        SorobanString::from_str(&env, "PDD"),
    ));
    documents.push_back((
        SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"),
        SorobanString::from_str(&env, "MONITORING_REPORT"),
    ));
    documents.push_back((
        SorobanString::from_str(&env, "QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V"),
        SorobanString::from_str(&env, "VERIFICATION"),
    ));

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    let version_indices = client.anchor_document_batch(&project_id, &documents);

    assert_eq!(version_indices.len(), 3);
    assert_eq!(version_indices.get(0).unwrap(), 0);
    assert_eq!(version_indices.get(1).unwrap(), 1);
    assert_eq!(version_indices.get(2).unwrap(), 2);

    let history = client.get_document_history(&project_id);
    assert_eq!(history.len(), 3);
}

#[test]
fn test_get_document_history() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let cid1 = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let cid2 = SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    client.anchor_document(&project_id, &cid1, &doc_type);
    client.anchor_document(&project_id, &cid2, &doc_type);

    let history = client.get_document_history(&project_id);
    assert_eq!(history.len(), 2);

    let record1 = history.get(0).unwrap();
    assert_eq!(record1.ipfs_cid, cid1);
    assert_eq!(record1.anchorer, project_owner);

    let record2 = history.get(1).unwrap();
    assert_eq!(record2.ipfs_cid, cid2);
}

#[test]
fn test_get_projects_by_anchorer() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id1 = SorobanString::from_str(&env, "PROJ-001");
    let project_id2 = SorobanString::from_str(&env, "PROJ-002");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id1, &project_owner);
    client.register_project(&project_id2, &project_owner);

    client.anchor_document(&project_id1, &ipfs_cid, &doc_type);
    client.anchor_document(&project_id2, &ipfs_cid, &doc_type);

    let projects = client.get_projects_by_anchorer(&project_owner);
    assert_eq!(projects.len(), 2);
    assert!(projects.contains(&project_id1));
    assert!(projects.contains(&project_id2));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_invalid_cid_format() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let invalid_cid = SorobanString::from_str(&env, "invalid-cid");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    client.anchor_document(&project_id, &invalid_cid, &doc_type); // Should panic
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_empty_batch() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let project_owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");

    let empty_documents = Vec::new(&env);

    client.initialize(&admin);
    client.register_project(&project_id, &project_owner);

    client.anchor_document_batch(&project_id, &empty_documents); // Should panic
}

// ========== Validation Tests ==========

#[test]
fn test_valid_cidv0() {
    let env = Env::default();
    let cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    assert!(validate_ipfs_cid(&cid).is_ok());
}

#[test]
fn test_valid_cidv1_base32() {
    let env = Env::default();
    let cid = SorobanString::from_str(
        &env,
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    );
    assert!(validate_ipfs_cid(&cid).is_ok());
}

#[test]
fn test_invalid_cid_too_short() {
    let env = Env::default();
    let cid = SorobanString::from_str(&env, "Qm123");
    assert_eq!(validate_ipfs_cid(&cid), Err(Error::InvalidCidFormat));
}

#[test]
fn test_invalid_cid_too_long() {
    let env = Env::default();
    // Create a string that's over 100 characters
    let long_cid = SorobanString::from_str(
        &env,
        "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6ucoQmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6ucoExtra",
    );
    assert_eq!(validate_ipfs_cid(&long_cid), Err(Error::InvalidCidFormat));
}

#[test]
fn test_valid_cid_min_length() {
    let env = Env::default();
    // Exactly 46 characters should pass
    let cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    assert!(validate_ipfs_cid(&cid).is_ok());
}
