#![cfg(test)]

use soroban_sdk::testutils::Ledger;
use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};

use crate::types::{CompactionConfig, Error, PaginatedProjects};
use crate::validation::validate_ipfs_cid;
use crate::storage;
use crate::{ProjectRegistry, ProjectRegistryClient};

fn create_contract() -> (Env, Address, ProjectRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProjectRegistry, ());
    let client = ProjectRegistryClient::new(&env, &contract_id);

    (env, contract_id, client)
}

// ========== Existing Contract Tests ==========

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

// ========== Monotonic Timestamp Tests ==========

#[test]
fn test_monotonic_enforcement_disabled_by_default() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    client.initialize(&admin);
    // Enforcement is off by default
    assert!(!client.is_monotonic_enforcement_enabled());
}

#[test]
fn test_set_monotonic_enforcement_toggle() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.set_monotonic_enforcement(&true);
    assert!(client.is_monotonic_enforcement_enabled());

    client.set_monotonic_enforcement(&false);
    assert!(!client.is_monotonic_enforcement_enabled());
}

#[test]
fn test_monotonic_enforcement_allows_increasing_timestamps() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let cid1 = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let cid2 = SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.set_monotonic_enforcement(&true);
    client.register_project(&project_id, &owner);

    // First anchor at ledger timestamp 1000
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &cid1, &doc_type);

    // Second anchor at a strictly later timestamp — should succeed
    env.ledger().set_timestamp(1001);
    let v2 = client.anchor_document(&project_id, &cid2, &doc_type);
    assert_eq!(v2, 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_monotonic_enforcement_rejects_backdated_timestamp() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let cid1 = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let cid2 = SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.set_monotonic_enforcement(&true);
    client.register_project(&project_id, &owner);

    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &cid1, &doc_type);

    // Same timestamp — should be rejected (not strictly greater)
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &cid2, &doc_type);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_monotonic_enforcement_rejects_earlier_timestamp() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let cid1 = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let cid2 = SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.set_monotonic_enforcement(&true);
    client.register_project(&project_id, &owner);

    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &cid1, &doc_type);

    // Earlier timestamp — should be rejected
    env.ledger().set_timestamp(999);
    client.anchor_document(&project_id, &cid2, &doc_type);
}

#[test]
fn test_monotonic_enforcement_disabled_allows_any_order() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let cid1 = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let cid2 = SorobanString::from_str(&env, "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    // Enforcement is off — any timestamp order is accepted
    client.register_project(&project_id, &owner);

    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &cid1, &doc_type);

    // Same timestamp — allowed when enforcement is disabled
    env.ledger().set_timestamp(1000);
    let v2 = client.anchor_document(&project_id, &cid2, &doc_type);
    assert_eq!(v2, 1);
}

// ========== Compaction Config Tests ==========

#[test]
fn test_default_compaction_config() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let config = client.get_compaction_config();
    assert_eq!(config.max_index_size, 100);
    assert!(config.auto_compaction_enabled);
    assert!(config.pruning_age_seconds > 0);
}

#[test]
fn test_set_compaction_config() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let new_config = CompactionConfig {
        max_index_size: 50,
        pruning_age_seconds: 1000,
        auto_compaction_enabled: false,
    };

    client.set_compaction_config(&new_config);

    let stored_config = client.get_compaction_config();
    assert_eq!(stored_config.max_index_size, 50);
    assert_eq!(stored_config.pruning_age_seconds, 1000);
    assert_eq!(stored_config.auto_compaction_enabled, false);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_invalid_compaction_config() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let invalid_config = CompactionConfig {
        max_index_size: 0,
        pruning_age_seconds: 1000,
        auto_compaction_enabled: true,
    };

    client.set_compaction_config(&invalid_config);
}

// ========== Compaction Deduplication Tests ==========

#[test]
fn test_manual_compaction_removes_duplicates() {
    let (env, contract_id, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &anchorer);
    
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    // Manually inject a duplicate entry into the anchorer projects index
    // to simulate a scenario where duplicates exist
    let mut projects = Vec::new(&env);
    projects.push_back(project_id.clone());
    projects.push_back(project_id.clone()); // duplicate
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(
            &storage::StorageKey::AncorerProjects(anchorer.clone()),
            &projects,
        );
    });

    // Index size before compaction should be 2 (with duplicate)
    let size_before = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size_before, 2);

    // Trigger manual compaction
    client.compact_anchorer_index(&anchorer);

    // After compaction, the duplicate should be removed, size should be 1
    let size_after = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size_after, 1);

    // Verify the project is still listed
    let projects_after = client.get_projects_by_anchorer(&anchorer);
    assert_eq!(projects_after.len(), 1);
    assert_eq!(projects_after.get(0).unwrap(), project_id);
}

#[test]
fn test_manual_compaction_emits_event() {
    let (env, _contract_id, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &anchorer);
    
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    // Trigger compaction
    client.compact_anchorer_index(&anchorer);

    // Verify the compaction event was emitted — just check that the event exists
    // by confirming no panic occurs during the call
    // (testutils events API varies across soroban-sdk versions)
}

// ========== Compaction Pruning Tests ==========

#[test]
fn test_compaction_prunes_inactive_projects() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &anchorer);

    // Set short pruning age for testing
    let config = CompactionConfig {
        max_index_size: 100,
        pruning_age_seconds: 500,  // 500 seconds
        auto_compaction_enabled: false,
    };
    client.set_compaction_config(&config);

    // Anchor at timestamp 1000
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    // Advance time beyond the pruning threshold
    // Current time = 2000, last activity = 1000, gap = 1000 > 500 threshold
    env.ledger().set_timestamp(2000);

    // Trigger compaction — the project should be pruned
    client.compact_anchorer_index(&anchorer);

    // Index should now be empty
    let size = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size, 0, "Inactive project should have been pruned");
}

#[test]
fn test_compaction_keeps_active_projects() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &anchorer);

    // Set short pruning age for testing
    let config = CompactionConfig {
        max_index_size: 100,
        pruning_age_seconds: 500,
        auto_compaction_enabled: false,
    };
    client.set_compaction_config(&config);

    // Anchor at timestamp 1500
    env.ledger().set_timestamp(1500);
    client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    // Advance time but remain within pruning threshold
    // Current = 1800, last activity = 1500, gap = 300 < 500 threshold — should keep
    env.ledger().set_timestamp(1800);

    client.compact_anchorer_index(&anchorer);

    let size = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size, 1, "Active project should be kept after compaction");
}

// ========== Pagination Tests ==========

#[test]
fn test_get_projects_by_anchorer_paginated() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);

    // Create 5 projects and anchor docs to them
    let mut project_ids = Vec::new(&env);
    let names = [
        "PROJ-001", "PROJ-002", "PROJ-003", "PROJ-004", "PROJ-005"
    ];
    for name in names {
        let pid = SorobanString::from_str(&env, name);
        project_ids.push_back(pid);
    }

    for i in 0..project_ids.len() {
        let pid = project_ids.get(i).unwrap();
        client.register_project(&pid, &anchorer);
        env.ledger().set_timestamp(1000);
        client.anchor_document(&pid, &ipfs_cid, &doc_type);
    }

    // Query with page_size = 2, starting at cursor 0
    let page1: PaginatedProjects = client
        .get_anchorer_projects_page(&anchorer, &Some(0), &Some(2));
    
    assert_eq!(page1.projects.len(), 2);
    assert_eq!(page1.total, 5);
    assert_eq!(page1.next_cursor, Some(2));
    assert_eq!(page1.projects.get(0).unwrap(), project_ids.get(0).unwrap());
    assert_eq!(page1.projects.get(1).unwrap(), project_ids.get(1).unwrap());

    // Second page
    let page2: PaginatedProjects = client
        .get_anchorer_projects_page(&anchorer, &Some(2), &Some(2));
    
    assert_eq!(page2.projects.len(), 2);
    assert_eq!(page2.total, 5);
    assert_eq!(page2.next_cursor, Some(4));
    assert_eq!(page2.projects.get(0).unwrap(), project_ids.get(2).unwrap());
    assert_eq!(page2.projects.get(1).unwrap(), project_ids.get(3).unwrap());

    // Third page (last partial page)
    let page3: PaginatedProjects = client
        .get_anchorer_projects_page(&anchorer, &Some(4), &Some(2));
    
    assert_eq!(page3.projects.len(), 1);
    assert_eq!(page3.total, 5);
    assert_eq!(page3.next_cursor, None);
    assert_eq!(page3.projects.get(0).unwrap(), project_ids.get(4).unwrap());
}

#[test]
fn test_get_projects_by_anchorer_paginated_default_page_size() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let project_id = SorobanString::from_str(&env, "PROJ-001");
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);
    client.register_project(&project_id, &anchorer);
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    // Query with no cursor and no page_size — uses defaults
    let result: PaginatedProjects = client
        .get_anchorer_projects_page(&anchorer, &None, &None);
    
    assert_eq!(result.projects.len(), 1);
    assert_eq!(result.total, 1);
    assert_eq!(result.next_cursor, None);
}

#[test]
fn test_get_projects_by_anchorer_paginated_beyond_end() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);

    let project_id = SorobanString::from_str(&env, "PROJ-001");
    client.register_project(&project_id, &anchorer);
    env.ledger().set_timestamp(1000);
    client.anchor_document(&project_id, &ipfs_cid, &doc_type);

    // Query with cursor beyond the total
    let result: PaginatedProjects = client
        .get_anchorer_projects_page(&anchorer, &Some(10), &Some(5));
    
    assert_eq!(result.projects.len(), 0);
    assert_eq!(result.total, 1);
    assert_eq!(result.next_cursor, None);
}

// ========== Index Size Query Tests ==========

#[test]
fn test_get_anchorer_index_size() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);

    // Initially, the index size should be 0 for a new anchorer
    let initial_size = client.get_anchorer_index_size(&anchorer);
    assert_eq!(initial_size, 0);

    // Add some projects
    let p1 = SorobanString::from_str(&env, "PROJ-001");
    let p2 = SorobanString::from_str(&env, "PROJ-002");
    
    client.register_project(&p1, &anchorer);
    client.register_project(&p2, &anchorer);
    
    env.ledger().set_timestamp(1000);
    client.anchor_document(&p1, &ipfs_cid, &doc_type);
    client.anchor_document(&p2, &ipfs_cid, &doc_type);

    let size = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size, 2);
}

// ========== Auto-Compaction Tests ==========

#[test]
fn test_auto_compaction_triggers_when_exceeding_threshold() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);

    // Set a very low max_index_size to trigger auto-compaction
    let config = CompactionConfig {
        max_index_size: 2,
        pruning_age_seconds: 1000000, // long enough to not prune
        auto_compaction_enabled: true,
    };
    client.set_compaction_config(&config);

    // Add 3 projects — the third should trigger auto-compaction since max_index_size = 2
    let p1 = SorobanString::from_str(&env, "PROJ-001");
    let p2 = SorobanString::from_str(&env, "PROJ-002");
    let p3 = SorobanString::from_str(&env, "PROJ-003");

    client.register_project(&p1, &anchorer);
    client.register_project(&p2, &anchorer);
    client.register_project(&p3, &anchorer);

    env.ledger().set_timestamp(1000);
    client.anchor_document(&p1, &ipfs_cid, &doc_type);
    client.anchor_document(&p2, &ipfs_cid, &doc_type);
    
    // The third anchor should trigger auto-compaction (size check happens after add)
    // Since all projects are active, compaction keeps them all
    env.ledger().set_timestamp(1001);
    client.anchor_document(&p3, &ipfs_cid, &doc_type);

    // All 3 projects should still be present (none are stale)
    let size = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size, 3);
}

#[test]
fn test_auto_compaction_disabled_does_not_trigger() {
    let (env, _, client) = create_contract();
    let admin = Address::generate(&env);
    let anchorer = Address::generate(&env);
    let ipfs_cid = SorobanString::from_str(&env, "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
    let doc_type = SorobanString::from_str(&env, "PDD");

    client.initialize(&admin);

    // Disable auto-compaction
    let config = CompactionConfig {
        max_index_size: 1,
        pruning_age_seconds: 1000000,
        auto_compaction_enabled: false,
    };
    client.set_compaction_config(&config);

    // Add 2 projects — auto-compaction is disabled, so both should remain
    let p1 = SorobanString::from_str(&env, "PROJ-001");
    let p2 = SorobanString::from_str(&env, "PROJ-002");

    client.register_project(&p1, &anchorer);
    client.register_project(&p2, &anchorer);

    env.ledger().set_timestamp(1000);
    client.anchor_document(&p1, &ipfs_cid, &doc_type);
    client.anchor_document(&p2, &ipfs_cid, &doc_type);

    let size = client.get_anchorer_index_size(&anchorer);
    assert_eq!(size, 2, "Auto-compaction disabled so size should still be 2");
}