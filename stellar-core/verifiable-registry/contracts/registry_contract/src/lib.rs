#![no_std]

mod events;
mod storage;
mod types;
mod validation;

use events::{emit_anchorer_index_compacted_event, emit_document_anchored_event};
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};
use storage::extend_instance_ttl;
use types::{CompactionConfig, DocumentRecord, Error, PaginatedProjects};
use validation::validate_ipfs_cid;

#[contract]
pub struct ProjectRegistry;

#[contractimpl]
impl ProjectRegistry {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if storage::has_admin(&env) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        storage::set_admin(&env, &admin);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Enable or disable strict monotonic timestamp enforcement (admin only).
    ///
    /// When enabled, every new document anchored for a project must have a
    /// timestamp strictly greater than the previous one, preventing backdating.
    pub fn set_monotonic_enforcement(env: Env, enabled: bool) -> Result<(), Error> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();
        storage::set_monotonic_enforcement(&env, enabled);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Return whether strict monotonic timestamp enforcement is currently enabled.
    pub fn is_monotonic_enforcement_enabled(env: Env) -> bool {
        storage::get_monotonic_enforcement(&env)
    }

    /// Register a new project and assign initial owner (admin only)
    pub fn register_project(env: Env, project_id: String, owner: Address) -> Result<(), Error> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();

        if storage::has_project_owner(&env, &project_id) {
            return Err(Error::ProjectAlreadyExists);
        }

        storage::set_project_owner(&env, &project_id, &owner);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Transfer project ownership to another address
    pub fn transfer_project_ownership(
        env: Env,
        project_id: String,
        new_owner: Address,
    ) -> Result<(), Error> {
        let current_owner = storage::get_project_owner(&env, &project_id)?;
        current_owner.require_auth();

        storage::set_project_owner(&env, &project_id, &new_owner);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Anchor a single document to a project
    pub fn anchor_document(
        env: Env,
        project_id: String,
        ipfs_cid: String,
        document_type: String,
    ) -> Result<u32, Error> {
        let owner = storage::get_project_owner(&env, &project_id)?;
        owner.require_auth();

        // Validate IPFS CID format
        validate_ipfs_cid(&ipfs_cid)?;

        let timestamp = env.ledger().timestamp();

        // Enforce strict monotonic timestamps when the flag is enabled
        if storage::get_monotonic_enforcement(&env) {
            if let Some(last_ts) = storage::get_last_timestamp(&env, &project_id) {
                if timestamp <= last_ts {
                    return Err(Error::TimestampNotMonotonic);
                }
            }
        }

        let record = DocumentRecord {
            ipfs_cid: ipfs_cid.clone(),
            timestamp,
            document_type: document_type.clone(),
            anchorer: owner.clone(),
        };

        // Get or create document history
        let mut history =
            storage::get_document_history(&env, &project_id).unwrap_or_else(|_| Vec::new(&env));

        let version_index = history.len();
        history.push_back(record);

        // Store updated history
        storage::set_document_history(&env, &project_id, &history);

        // Update last recorded timestamp for monotonic enforcement
        storage::set_last_timestamp(&env, &project_id, timestamp);

        // Track project's last document timestamp for pruning decisions
        storage::set_project_last_document_timestamp(&env, &project_id, timestamp);

        // Update anchorer index
        let mut anchorer_projects =
            storage::get_anchorer_projects(&env, &owner).unwrap_or_else(|_| Vec::new(&env));

        // Add project_id if not already in the list
        if !anchorer_projects.contains(&project_id) {
            anchorer_projects.push_back(project_id.clone());
            storage::set_anchorer_projects(&env, &owner, &anchorer_projects);
        }

        // Check if auto-compaction should trigger after this write
        storage::maybe_auto_compact(&env, &owner);

        // Emit event for off-chain indexing
        emit_document_anchored_event(&env, project_id, ipfs_cid, document_type, version_index);

        extend_instance_ttl(&env);

        Ok(version_index)
    }

    /// Anchor multiple documents to a project in a single transaction
    pub fn anchor_document_batch(
        env: Env,
        project_id: String,
        documents: Vec<(String, String)>, // Vec of (ipfs_cid, document_type)
    ) -> Result<Vec<u32>, Error> {
        let owner = storage::get_project_owner(&env, &project_id)?;
        owner.require_auth();

        if documents.is_empty() {
            return Err(Error::EmptyBatch);
        }

        let timestamp = env.ledger().timestamp();

        // Enforce strict monotonic timestamps when the flag is enabled
        if storage::get_monotonic_enforcement(&env) {
            if let Some(last_ts) = storage::get_last_timestamp(&env, &project_id) {
                if timestamp <= last_ts {
                    return Err(Error::TimestampNotMonotonic);
                }
            }
        }

        let mut history =
            storage::get_document_history(&env, &project_id).unwrap_or_else(|_| Vec::new(&env));

        let mut version_indices = Vec::new(&env);

        for i in 0..documents.len() {
            let (ipfs_cid, document_type) = documents.get(i).unwrap();

            // Validate IPFS CID format
            validate_ipfs_cid(&ipfs_cid)?;

            let record = DocumentRecord {
                ipfs_cid: ipfs_cid.clone(),
                timestamp,
                document_type: document_type.clone(),
                anchorer: owner.clone(),
            };

            let version_index = history.len();
            history.push_back(record);
            version_indices.push_back(version_index);

            // Emit event for each document
            emit_document_anchored_event(
                &env,
                project_id.clone(),
                ipfs_cid,
                document_type,
                version_index,
            );
        }

        // Store updated history
        storage::set_document_history(&env, &project_id, &history);

        // Update last recorded timestamp for monotonic enforcement
        storage::set_last_timestamp(&env, &project_id, timestamp);

        // Track project's last document timestamp for pruning decisions
        storage::set_project_last_document_timestamp(&env, &project_id, timestamp);

        // Update anchorer index
        let mut anchorer_projects =
            storage::get_anchorer_projects(&env, &owner).unwrap_or_else(|_| Vec::new(&env));

        if !anchorer_projects.contains(&project_id) {
            anchorer_projects.push_back(project_id.clone());
            storage::set_anchorer_projects(&env, &owner, &anchorer_projects);
        }

        // Check if auto-compaction should trigger after this write
        storage::maybe_auto_compact(&env, &owner);

        extend_instance_ttl(&env);

        Ok(version_indices)
    }

    /// Get the latest anchored CID for a project
    pub fn get_latest_cid(env: Env, project_id: String) -> Result<String, Error> {
        let history = storage::get_document_history(&env, &project_id)?;

        if history.is_empty() {
            return Err(Error::NoDocumentsFound);
        }

        let latest = history.get(history.len() - 1).unwrap();
        Ok(latest.ipfs_cid)
    }

    /// Get the complete document history for a project
    pub fn get_document_history(
        env: Env,
        project_id: String,
    ) -> Result<Vec<DocumentRecord>, Error> {
        storage::get_document_history(&env, &project_id)
    }

    /// Get all projects that an address has anchored documents for
    pub fn get_projects_by_anchorer(env: Env, anchorer: Address) -> Result<Vec<String>, Error> {
        storage::get_anchorer_projects(&env, &anchorer)
    }

    /// Get paginated projects by anchorer
    pub fn get_anchorer_projects_page(
        env: Env,
        anchorer: Address,
        cursor: Option<u32>,
        page_size: Option<u32>,
    ) -> PaginatedProjects {
        storage::get_anchorer_projects_paginated(&env, &anchorer, cursor, page_size)
    }

    /// Get the current size of the anchorer index for a given address
    pub fn get_anchorer_index_size(env: Env, anchorer: Address) -> u32 {
        storage::get_anchorer_index_size(&env, &anchorer)
    }

    /// Get the compaction configuration
    pub fn get_compaction_config(env: Env) -> CompactionConfig {
        storage::get_compaction_config(&env)
    }

    /// Update the compaction configuration (admin only)
    pub fn set_compaction_config(env: Env, config: CompactionConfig) -> Result<(), Error> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();

        // Validate config parameters
        if config.max_index_size == 0 {
            return Err(Error::InvalidCompactionConfig);
        }

        storage::set_compaction_config(&env, &config);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Manually trigger compaction for all anchorers or a specific anchorer (admin only)
    pub fn compact_anchorer_index(env: Env, anchorer: Address) -> Result<(), Error> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();

        let stats = storage::compact_anchorer_index(&env, &anchorer);

        // Emit compaction event for auditability
        emit_anchorer_index_compacted_event(
            &env,
            anchorer,
            stats.duplicates_removed,
            stats.pruned_projects,
            stats.remaining_projects,
        );

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Get the owner of a project
    pub fn get_project_owner(env: Env, project_id: String) -> Result<Address, Error> {
        storage::get_project_owner(&env, &project_id)
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        storage::get_admin(&env)
    }
}

#[cfg(test)]
mod test;