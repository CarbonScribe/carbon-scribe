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

// Mint cap events (issue #472)

/// Emitted when the contract-level max supply is configured by the admin.
#[contractevent]
pub struct MintCapSetEvent {
    pub sequence: u64,
    pub max_supply: u32,
    pub set_by: Address,
}

/// Emitted when the max supply cap is reached during a mint operation.
#[contractevent]
pub struct MintCapReachedEvent {
    pub sequence: u64,
    pub total_minted: u32,
    pub max_supply: u32,
}

/// Emitted when an admin permanently freezes minting.
#[contractevent]
pub struct MintingFrozenEvent {
    pub sequence: u64,
    pub frozen_by: Address,
}

// Admin transfer events (issue #557)

/// Emitted when the current admin proposes a successor. get_admin() still
/// returns current_admin until a matching accept_admin_transfer lands.
#[contractevent]
pub struct AdminTransferProposedEvent {
    pub sequence: u64,
    pub current_admin: Address,
    pub proposed_admin: Address,
}

/// Emitted when a pending admin transfer is accepted and DataKey::Admin is
/// rotated to new_admin.
#[contractevent]
pub struct AdminTransferAcceptedEvent {
    pub sequence: u64,
    pub old_admin: Address,
    pub new_admin: Address,
}
