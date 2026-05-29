use soroban_sdk::{contractevent, Address, String};

use crate::types::AssetStatus;

#[contractevent]
pub struct MintEvent {
    pub sequence: u64,
    pub token_id: u32,
    pub owner: Address,
    pub project_id: String,
    pub vintage_year: u64,
    pub methodology_id: u32,
}

#[contractevent]
pub struct TransferEvent {
    pub sequence: u64,
    pub token_id: u32,
    pub from: Address,
    pub to: Address,
}

#[contractevent]
pub struct StatusChangeEvent {
    pub sequence: u64,
    pub token_id: u32,
    pub old_status: Option<AssetStatus>,
    pub new_status: AssetStatus,
    pub changed_by: Address,
}

#[contractevent]
pub struct QualityScoreUpdatedEvent {
    pub sequence: u64,
    pub token_id: u32,
    pub old_score: i128,
    pub new_score: i128,
    pub updated_by: Address,
}

// SEP-41 style events
#[contractevent]
pub struct ApproveEvent {
    pub sequence: u64,
    pub from: Address,
    pub spender: Address,
    pub amount: i128,
    pub live_until_ledger: u32,
}

#[contractevent]
pub struct Sep41TransferEvent {
    pub sequence: u64,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Sep41BurnEvent {
    pub sequence: u64,
    pub from: Address,
    pub amount: i128,
}
