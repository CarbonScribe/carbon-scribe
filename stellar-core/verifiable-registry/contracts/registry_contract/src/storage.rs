use crate::types::{CompactionConfig, DocumentRecord, Error, PaginatedProjects};
use soroban_sdk::{contracttype, Address, Env, String, Vec};

const DAY_IN_LEDGERS: u32 = 17280; // Approximately 1 day worth of ledgers (5s per ledger)
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const DEFAULT_MAX_INDEX_SIZE: u32 = 100;
const DEFAULT_PRUNING_AGE_SECONDS: u64 = 365 * 24 * 60 * 60; // 1 year
const DEFAULT_PAGE_SIZE: u32 = 20;

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Admin,
    ProjectOwner(String),
    DocumentHistory(String),
    AncorerProjects(Address),
    /// Whether strict monotonic timestamp enforcement is enabled
    MonotonicEnforcement,
    /// Last recorded timestamp for a project (project_id -> u64)
    LastTimestamp(String),
    /// Compaction configuration
    CompactionConfig,
    /// Last activity timestamp per anchorer (anchorer -> u64)
    AnchorerLastActivity(Address),
    /// Last document timestamp per project (project_id -> u64) for pruning decisions
    ProjectLastDocumentTimestamp(String),
}

/// Extend the TTL of instance storage
pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

// Admin storage functions
pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&StorageKey::Admin)
}

pub fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&StorageKey::Admin)
        .ok_or(Error::AdminNotFound)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&StorageKey::Admin, admin);
}

// Project owner storage functions
pub fn has_project_owner(env: &Env, project_id: &String) -> bool {
    let key = StorageKey::ProjectOwner(project_id.clone());
    env.storage().persistent().has(&key)
}

pub fn get_project_owner(env: &Env, project_id: &String) -> Result<Address, Error> {
    let key = StorageKey::ProjectOwner(project_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ProjectNotFound)
}

pub fn set_project_owner(env: &Env, project_id: &String, owner: &Address) {
    let key = StorageKey::ProjectOwner(project_id.clone());
    env.storage().persistent().set(&key, owner);
    env.storage()
        .persistent()
        .extend_ttl(&key, INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

// Document history storage functions
pub fn get_document_history(env: &Env, project_id: &String) -> Result<Vec<DocumentRecord>, Error> {
    let key = StorageKey::DocumentHistory(project_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NoDocumentsFound)
}

pub fn set_document_history(env: &Env, project_id: &String, history: &Vec<DocumentRecord>) {
    let key = StorageKey::DocumentHistory(project_id.clone());
    env.storage().persistent().set(&key, history);
    env.storage()
        .persistent()
        .extend_ttl(&key, INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

// Anchorer index storage functions
pub fn get_anchorer_projects(env: &Env, anchorer: &Address) -> Result<Vec<String>, Error> {
    let key = StorageKey::AncorerProjects(anchorer.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::NoProjectsFound)
}

pub fn set_anchorer_projects(env: &Env, anchorer: &Address, projects: &Vec<String>) {
    let key = StorageKey::AncorerProjects(anchorer.clone());
    env.storage().persistent().set(&key, projects);
    env.storage()
        .persistent()
        .extend_ttl(&key, INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

// Monotonic timestamp enforcement storage functions

pub fn get_monotonic_enforcement(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&StorageKey::MonotonicEnforcement)
        .unwrap_or(false)
}

pub fn set_monotonic_enforcement(env: &Env, enabled: bool) {
    env.storage()
        .instance()
        .set(&StorageKey::MonotonicEnforcement, &enabled);
}

pub fn get_last_timestamp(env: &Env, project_id: &String) -> Option<u64> {
    env.storage()
        .persistent()
        .get(&StorageKey::LastTimestamp(project_id.clone()))
}

pub fn set_last_timestamp(env: &Env, project_id: &String, timestamp: u64) {
    let key = StorageKey::LastTimestamp(project_id.clone());
    env.storage().persistent().set(&key, &timestamp);
    env.storage()
        .persistent()
        .extend_ttl(&key, INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

// ========== Compaction Configuration ==========

pub fn get_compaction_config(env: &Env) -> CompactionConfig {
    env.storage()
        .instance()
        .get(&StorageKey::CompactionConfig)
        .unwrap_or(CompactionConfig {
            max_index_size: DEFAULT_MAX_INDEX_SIZE,
            pruning_age_seconds: DEFAULT_PRUNING_AGE_SECONDS,
            auto_compaction_enabled: true,
        })
}

pub fn set_compaction_config(env: &Env, config: &CompactionConfig) {
    env.storage()
        .instance()
        .set(&StorageKey::CompactionConfig, config);
}

// ========== Anchorer Last Activity ==========

pub fn set_anchorer_last_activity(env: &Env, anchorer: &Address, timestamp: u64) {
    let key = StorageKey::AnchorerLastActivity(anchorer.clone());
    env.storage().persistent().set(&key, &timestamp);
    env.storage()
        .persistent()
        .extend_ttl(&key, INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn get_anchorer_last_activity(env: &Env, anchorer: &Address) -> Option<u64> {
    let key = StorageKey::AnchorerLastActivity(anchorer.clone());
    env.storage().persistent().get(&key)
}

// ========== Project Last Document Timestamp (for pruning) ==========

pub fn set_project_last_document_timestamp(env: &Env, project_id: &String, timestamp: u64) {
    let key = StorageKey::ProjectLastDocumentTimestamp(project_id.clone());
    env.storage().persistent().set(&key, &timestamp);
    env.storage()
        .persistent()
        .extend_ttl(&key, INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

pub fn get_project_last_document_timestamp(env: &Env, project_id: &String) -> Option<u64> {
    let key = StorageKey::ProjectLastDocumentTimestamp(project_id.clone());
    env.storage().persistent().get(&key)
}

// ========== Index Size Query ==========

/// Returns the number of unique projects currently stored for an anchorer
pub fn get_anchorer_index_size(env: &Env, anchorer: &Address) -> u32 {
    match get_anchorer_projects(env, anchorer) {
        Ok(projects) => projects.len(),
        Err(_) => 0,
    }
}

// ========== Paginated Query ==========

/// Returns a paginated slice of projects for an anchorer
pub fn get_anchorer_projects_paginated(
    env: &Env,
    anchorer: &Address,
    cursor: Option<u32>,
    page_size: Option<u32>,
) -> PaginatedProjects {
    let projects = get_anchorer_projects(env, anchorer).unwrap_or_else(|_| Vec::new(env));
    let total = projects.len();

    let start = cursor.unwrap_or(0);
    let size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);

    // If cursor is beyond the end, return empty
    if start >= total {
        return PaginatedProjects {
            projects: Vec::new(env),
            total,
            next_cursor: None,
        };
    }

    let end = (start + size).min(total);
    let mut page_projects = Vec::new(env);
    for i in start..end {
        if let Some(pid) = projects.get(i) {
            page_projects.push_back(pid);
        }
    }

    let next_cursor = if end < total { Some(end) } else { None };

    PaginatedProjects {
        projects: page_projects,
        total,
        next_cursor,
    }
}

// ========== Compaction Logic ==========

/// Compaction result statistics
pub struct CompactionStats {
    pub duplicates_removed: u32,
    pub pruned_projects: u32,
    pub remaining_projects: u32,
}

/// Perform compaction on an anchorer's project index:
/// 1. Remove duplicate project entries
/// 2. Remove projects that have been inactive beyond the configured pruning age
pub fn compact_anchorer_index(
    env: &Env,
    anchorer: &Address,
) -> CompactionStats {
    let config = get_compaction_config(env);
    let now = env.ledger().timestamp();

    let projects = get_anchorer_projects(env, anchorer).unwrap_or_else(|_| Vec::new(env));
    let original_len = projects.len();

    // Step 1: Deduplicate while preserving order (keep first occurrence)
    let mut seen = soroban_sdk::Map::new(env);
    let mut deduped = Vec::new(env);
    let mut duplicates_removed: u32 = 0;

    for i in 0..original_len {
        if let Some(pid) = projects.get(i) {
            if seen.contains_key(pid.clone()) {
                duplicates_removed += 1;
            } else {
                seen.set(pid.clone(), true);
                deduped.push_back(pid);
            }
        }
    }

    // Step 2: Prune projects with no active documents (inactive beyond threshold)
    let mut pruned: u32 = 0;
    let mut compacted = Vec::new(env);

    for i in 0..deduped.len() {
        if let Some(pid) = deduped.get(i) {
            let should_keep = match get_project_last_document_timestamp(env, &pid) {
                Some(last_doc_ts) => {
                    // Keep if the project has been active within the pruning age
                    now.saturating_sub(last_doc_ts) <= config.pruning_age_seconds
                }
                None => {
                    // If no document timestamp is tracked, check the document history directly
                    match get_document_history(env, &pid) {
                        Ok(history) if history.len() > 0 => {
                            let last_record = history.get(history.len() - 1).unwrap();
                            now.saturating_sub(last_record.timestamp) <= config.pruning_age_seconds
                        }
                        _ => {
                            // No documents at all — consider this project stale
                            false
                        }
                    }
                }
            };

            if should_keep {
                compacted.push_back(pid);
            } else {
                pruned += 1;
            }
        }
    }

    // Write back the compacted list
    set_anchorer_projects(env, anchorer, &compacted);

    // Update last activity for the anchorer
    if compacted.len() > 0 {
        set_anchorer_last_activity(env, anchorer, now);
    }

    CompactionStats {
        duplicates_removed,
        pruned_projects: pruned,
        remaining_projects: compacted.len(),
    }
}

/// Check if auto-compaction should be triggered after an index write.
/// Returns true if compaction was performed.
pub fn maybe_auto_compact(env: &Env, anchorer: &Address) -> bool {
    let config = get_compaction_config(env);
    if !config.auto_compaction_enabled {
        return false;
    }

    let size = get_anchorer_index_size(env, anchorer);
    if size > config.max_index_size {
        compact_anchorer_index(env, anchorer);
        return true;
    }

    false
}