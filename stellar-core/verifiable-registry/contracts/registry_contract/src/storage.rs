use crate::types::{DocumentRecord, Error};
use soroban_sdk::{contracttype, Address, Env, String, Vec};

const DAY_IN_LEDGERS: u32 = 17280; // Approximately 1 day worth of ledgers (5s per ledger)
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Admin,
    ProjectOwner(String),
    DocumentHistory(String),
    AncorerProjects(Address),
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
