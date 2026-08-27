#![no_std]

mod errors;
mod events;
mod storage;
mod types;
#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, IntoVal, String, Symbol, Vec};

use crate::errors::ContractError;
use crate::events::{
    AdminTransferAcceptedEvent, AdminTransferProposedEvent, ApproveEvent, MintCapReachedEvent,
    MintCapSetEvent, MintEvent, MintingFrozenEvent, QualityScoreUpdatedEvent, Sep41BurnEvent,
    Sep41TransferEvent, StatusChangeEvent, TransferEvent,
};
use crate::storage::DataKey;
use crate::types::{AllowanceData, AssetStatus, CarbonAssetMetadata, OperationType, ValidationResult};

// ========================================================================
// Contract
// ========================================================================

#[contract]
pub struct CarbonAsset;

#[contractimpl]
impl CarbonAsset {
    // ====================================================================
    // Initialization
    // ====================================================================

    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        retirement_tracker: Address,
        host_jurisdiction: String,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::RetirementTracker, &retirement_tracker);
        env.storage()
            .instance()
            .set(&DataKey::HostJurisdiction, &host_jurisdiction);
        env.storage().instance().set(&DataKey::NextTokenId, &1u32);
        env.storage().instance().set(&DataKey::EventSequence, &0u64);
        // Initialise mint cap tracking counters
        env.storage().instance().set(&DataKey::TotalMinted, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::MintingFrozen, &false);

        Ok(())
    }

    // ====================================================================
    // Minting
    // ====================================================================

    pub fn mint(
        env: Env,
        caller: Address,
        owner: Address,
        metadata: CarbonAssetMetadata,
    ) -> Result<u32, ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        // --- Mint cap enforcement (issue #472) ---

        // 1. Check minting freeze flag
        let frozen: bool = env
            .storage()
            .instance()
            .get(&DataKey::MintingFrozen)
            .unwrap_or(false);
        if frozen {
            return Err(ContractError::MintingIsFrozen);
        }

        // 2. Fetch current total minted count
        let total_minted: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0u32);

        // 3. Check contract-level max supply cap if set
        let max_supply_opt: Option<u32> = env.storage().instance().get(&DataKey::MaxSupply);
        if let Some(max_supply) = max_supply_opt {
            if total_minted >= max_supply {
                // Emit cap-reached event before returning error
                let sequence: u64 = env
                    .storage()
                    .instance()
                    .get(&DataKey::EventSequence)
                    .unwrap_or(0u64);
                let cap_seq = sequence + 1;
                env.storage()
                    .instance()
                    .set(&DataKey::EventSequence, &cap_seq);
                MintCapReachedEvent {
                    sequence: cap_seq,
                    total_minted,
                    max_supply,
                }
                .publish(&env);

                return Err(ContractError::SupplyLimitExceeded);
            }
        }

        // --- Actual token minting ---

        let token_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .ok_or(ContractError::NotInitialized)?;

        env.storage()
            .instance()
            .set(&DataKey::NextTokenId, &(token_id + 1));

        // Increment total minted counter
        env.storage()
            .instance()
            .set(&DataKey::TotalMinted, &(total_minted + 1));

        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &owner);
        Self::add_token_to_owner(env.clone(), owner.clone(), token_id);
        env.storage()
            .persistent()
            .set(&DataKey::Metadata(token_id), &metadata);
        env.storage()
            .persistent()
            .set(&DataKey::Status(token_id), &AssetStatus::Issued);
        env.storage()
            .persistent()
            .set(&DataKey::QualityScore(token_id), &0i128);
        env.storage()
            .persistent()
            .set(&DataKey::Burned(token_id), &false);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let mint_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &mint_sequence);
        MintEvent {
            sequence: mint_sequence,
            token_id,
            owner: owner.clone(),
            project_id: metadata.project_id.clone(),
            vintage_year: metadata.vintage_year,
            methodology_id: metadata.methodology_id,
        }
        .publish(&env);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let status_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &status_sequence);
        StatusChangeEvent {
            sequence: status_sequence,
            token_id,
            old_status: None,
            new_status: AssetStatus::Issued,
            changed_by: caller,
        }
        .publish(&env);

        // Emit cap-reached event if we just hit the cap exactly
        if let Some(max_supply) = max_supply_opt {
            if total_minted + 1 == max_supply {
                let sequence: u64 = env
                    .storage()
                    .instance()
                    .get(&DataKey::EventSequence)
                    .unwrap_or(0u64);
                let cap_seq = sequence + 1;
                env.storage()
                    .instance()
                    .set(&DataKey::EventSequence, &cap_seq);
                MintCapReachedEvent {
                    sequence: cap_seq,
                    total_minted: total_minted + 1,
                    max_supply,
                }
                .publish(&env);
            }
        }

        Ok(token_id)
    }

    // ====================================================================
    // SEP-41 Token Interface (count-based)
    // ====================================================================

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(from, spender);
        if let Some(allowance) = env.storage().persistent().get::<DataKey, AllowanceData>(&key) {
            if allowance.live_until_ledger < env.ledger().sequence() {
                0
            } else {
                allowance.amount
            }
        } else {
            0
        }
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        live_until_ledger: u32,
    ) -> Result<(), ContractError> {
        from.require_auth();

        let current_ledger = env.ledger().sequence();
        if amount != 0 && live_until_ledger < current_ledger {
            return Err(ContractError::InvalidStatusTransition);
        }

        let key = DataKey::Allowance(from.clone(), spender.clone());
        let data = AllowanceData {
            amount,
            live_until_ledger,
        };
        env.storage().persistent().set(&key, &data);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        ApproveEvent {
            sequence: next_sequence,
            from,
            spender,
            amount,
            live_until_ledger,
        }
        .publish(&env);

        Ok(())
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        Self::balance_of(env, owner)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), ContractError> {
        from.require_auth();
        Self::transfer_amount_internal(env, from, to, amount)
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        spender.require_auth();

        let allowance = Self::spend_allowance(env.clone(), from.clone(), spender.clone(), amount)?;
        let key = DataKey::Allowance(from.clone(), spender);
        env.storage().persistent().set(&key, &allowance);

        Self::transfer_amount_internal(env, from, to, amount)
    }

    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), ContractError> {
        let retirement_tracker = Self::get_retirement_tracker(env.clone())?;
        retirement_tracker.require_auth();

        Self::burn_amount_internal(env, from, amount)
    }

    pub fn burn_from(
        env: Env,
        spender: Address,
        from: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        let retirement_tracker = Self::get_retirement_tracker(env.clone())?;
        if spender != retirement_tracker {
            return Err(ContractError::NotAuthorized);
        }
        retirement_tracker.require_auth();

        Self::burn_amount_internal(env, from, amount)
    }

    // ====================================================================
    // Burning (Retirement)
    // ====================================================================

    // C-01 extension: burn a specific token_id (used by RetirementTracker for 1:1 retirement).
    pub fn burn_token(env: Env, token_id: u32, from: Address) -> Result<(), ContractError> {
        let retirement_tracker = Self::get_retirement_tracker(env.clone())?;
        retirement_tracker.require_auth();

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != from {
            return Err(ContractError::NotOwner);
        }

        let burned: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Burned(token_id))
            .unwrap_or(false);
        if burned {
            return Err(ContractError::TokenAlreadyBurned);
        }

        let status = Self::get_status(env.clone(), token_id)?;
        if status == AssetStatus::Invalidated {
            return Err(ContractError::StatusFrozen);
        }
        if status != AssetStatus::Retired {
            Self::set_status_internal(
                env.clone(),
                token_id,
                AssetStatus::Retired,
                retirement_tracker.clone(),
            )?;
        }

        Self::remove_token_from_owner(env.clone(), from, token_id)?;
        env.storage()
            .persistent()
            .set(&DataKey::Burned(token_id), &true);
        env.storage()
            .persistent()
            .remove(&DataKey::Owner(token_id));

        Ok(())
    }

    // ====================================================================
    // Compliance Hook
    // ====================================================================

    pub fn before_transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: u32,
    ) -> Result<bool, ContractError> {
        let _status = Self::get_status(env.clone(), token_id)?;

        let regulatory_contract: Option<Address> = env
            .storage()
            .instance()
            .get(&DataKey::RegulatoryCheck);

        // Fail-open by design: regulatory checking is an opt-in, per-deployment
        // feature (see set_regulatory_check). A deployment that has never
        // configured a regulatory contract hasn't opted into compliance
        // gating at all, so there is no jurisdiction rule to enforce and none
        // is being claimed — treating every transfer as non-compliant would
        // brick transfers for every deployment that doesn't use this feature.
        // ContractError::RegulatoryNotSet is reserved for a path that
        // requires regulatory config to be present and finds it missing;
        // this optional hook isn't that path. See
        // test_before_transfer_without_regulatory_contract_is_fail_open.
        if regulatory_contract.is_none() {
            return Ok(true);
        }

        let host_jurisdiction: Option<String> = env
            .storage()
            .instance()
            .get(&DataKey::HostJurisdiction);

        let host_jurisdiction = match host_jurisdiction {
            Some(value) => value,
            None => return Err(ContractError::HostJurisdictionNotSet),
        };

        let contract = regulatory_contract.unwrap();
        let retirement_tracker = Self::get_retirement_tracker(env.clone())?;
        let operation = if to == retirement_tracker {
            OperationType::RETIREMENT
        } else {
            OperationType::TRANSFER
        };
        let symbol = Symbol::new(&env, "validate_transaction");
        let mut args = Vec::new(&env);
        args.push_back(from.into_val(&env));
        args.push_back(to.into_val(&env));
        args.push_back(operation.into_val(&env));
        args.push_back(host_jurisdiction.into_val(&env));

        // try_invoke_contract (rather than the trapping invoke_contract) so a
        // missing/undeployed contract, a missing validate_transaction export,
        // an argument mismatch, an internal panic, or a return value that
        // doesn't deserialize as ValidationResult all surface as a typed
        // ComplianceCallFailed instead of aborting the whole host invocation.
        let call_result: Result<
            Result<ValidationResult, _>,
            Result<soroban_sdk::Error, soroban_sdk::InvokeError>,
        > = env.try_invoke_contract::<ValidationResult, soroban_sdk::Error>(
            &contract, &symbol, args,
        );

        let result = match call_result {
            Ok(Ok(value)) => value,
            // Call succeeded but the returned value didn't deserialize as
            // ValidationResult, or the call failed outright (contract not
            // deployed, function not found, argument mismatch, internal
            // panic, or the contract returned its own typed error).
            Ok(Err(_)) | Err(_) => return Err(ContractError::ComplianceCallFailed),
        };

        Ok(result.is_compliant && !result.requires_authorization)
    }

    // ====================================================================
    // Status Management
    // ====================================================================

    pub fn set_status(
        env: Env,
        caller: Address,
        token_id: u32,
        new_status: AssetStatus,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        let current = Self::get_status(env.clone(), token_id)?;
        if current == AssetStatus::Retired || current == AssetStatus::Invalidated {
            return Err(ContractError::StatusFrozen);
        }

        if new_status == AssetStatus::Issued {
            return Err(ContractError::InvalidStatusTransition);
        }

        Self::set_status_internal(env, token_id, new_status, caller)
    }

    // ====================================================================
    // Quality Score Updates
    // ====================================================================

    pub fn set_oracle(env: Env, caller: Address, oracle: Address) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage().instance().set(&DataKey::Oracle, &oracle);
        Ok(())
    }

    pub fn update_quality_score(
        env: Env,
        caller: Address,
        token_id: u32,
        new_score: i128,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let admin = Self::get_admin(env.clone())?;
        let oracle: Option<Address> = env.storage().instance().get(&DataKey::Oracle);

        if caller != admin {
            match oracle {
                Some(oracle_addr) if caller == oracle_addr => {}
                _ => return Err(ContractError::NotAuthorized),
            }
        }

        let old_score: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::QualityScore(token_id))
            .ok_or(ContractError::TokenNotFound)?;

        env.storage()
            .persistent()
            .set(&DataKey::QualityScore(token_id), &new_score);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        QualityScoreUpdatedEvent {
            sequence: next_sequence,
            token_id,
            old_score,
            new_score,
            updated_by: caller,
        }
        .publish(&env);

        Ok(())
    }

    // ====================================================================
    // Admin Transfer (two-step propose/accept, issue #557)
    // ====================================================================
    //
    // DataKey::Admin can only ever change via this propose/accept flow — no
    // other function in this contract writes it directly. This is
    // deliberately narrower than the single-step admin-gated setters below
    // (set_retirement_tracker, set_regulatory_check, set_host_jurisdiction,
    // set_oracle): those stay one-step by design, since a wrong contract
    // address there is recoverable by the admin calling the setter again,
    // whereas a wrong Admin address with no acceptance step would
    // permanently brick every privileged function in this contract at
    // once. Only the admin key itself gets the two-step treatment.

    /// Propose `new_admin` as the successor admin. Requires the *current*
    /// admin's auth. Does not touch DataKey::Admin — get_admin() keeps
    /// returning the current admin until accept_admin_transfer lands.
    pub fn propose_admin_transfer(
        env: Env,
        caller: Address,
        new_admin: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        AdminTransferProposedEvent {
            sequence: next_sequence,
            current_admin: admin,
            proposed_admin: new_admin,
        }
        .publish(&env);

        Ok(())
    }

    /// Accept a pending admin transfer. Requires the auth of the address
    /// currently in PendingAdmin — only that address may complete the
    /// rotation. Copies PendingAdmin into Admin and clears PendingAdmin.
    pub fn accept_admin_transfer(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();

        let pending_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(ContractError::NoPendingAdmin)?;

        if caller != pending_admin {
            return Err(ContractError::NotPendingAdmin);
        }

        let old_admin = Self::get_admin(env.clone())?;

        env.storage()
            .instance()
            .set(&DataKey::Admin, &pending_admin);
        env.storage().instance().remove(&DataKey::PendingAdmin);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        AdminTransferAcceptedEvent {
            sequence: next_sequence,
            old_admin,
            new_admin: pending_admin,
        }
        .publish(&env);

        Ok(())
    }

    /// Cancel an in-flight admin transfer proposal. Restricted to the
    /// *current* admin. Clears PendingAdmin without touching Admin; a
    /// no-op (but still admin-gated) if nothing was pending.
    pub fn cancel_admin_transfer(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage().instance().remove(&DataKey::PendingAdmin);

        Ok(())
    }

    // ====================================================================
    // Admin Configuration
    // ====================================================================
    //
    // The setters below remain single-step, admin-gated writes — see the
    // "Admin Transfer" section above for why only DataKey::Admin itself
    // gets a propose/accept flow.

    pub fn set_retirement_tracker(
        env: Env,
        caller: Address,
        retirement_tracker: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::RetirementTracker, &retirement_tracker);
        Ok(())
    }

    pub fn set_regulatory_check(
        env: Env,
        caller: Address,
        regulatory_check: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::RegulatoryCheck, &regulatory_check);
        Ok(())
    }

    pub fn set_host_jurisdiction(
        env: Env,
        caller: Address,
        host_jurisdiction: String,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::HostJurisdiction, &host_jurisdiction);
        Ok(())
    }

    // ====================================================================
    // Mint Cap Admin Functions (issue #472)
    // ====================================================================

    /// Set the contract-level maximum supply (mint cap).
    ///
    /// Rules:
    /// - Only the admin may call this.
    /// - The cap can only be set **once** (immutable after first set).
    /// - The cap cannot be set below the current `TotalMinted` count.
    pub fn set_max_supply(
        env: Env,
        caller: Address,
        max_supply: u32,
    ) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        // Immutability: cap can only be set once
        if env.storage().instance().has(&DataKey::MaxSupply) {
            return Err(ContractError::MaxSupplyAlreadySet);
        }

        // Cap must be at or above the current total minted
        let total_minted: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0u32);
        if max_supply < total_minted {
            return Err(ContractError::MaxSupplyBelowMinted);
        }

        env.storage()
            .instance()
            .set(&DataKey::MaxSupply, &max_supply);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        MintCapSetEvent {
            sequence: next_sequence,
            max_supply,
            set_by: caller,
        }
        .publish(&env);

        Ok(())
    }

    /// Permanently freeze minting. Once frozen, no further tokens can be minted.
    /// This is a one-way, irreversible operation restricted to the admin.
    pub fn freeze_minting(env: Env, caller: Address) -> Result<(), ContractError> {
        caller.require_auth();
        let admin = Self::get_admin(env.clone())?;
        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        // Already frozen is a no-op to keep things idempotent, but we still emit event
        env.storage()
            .instance()
            .set(&DataKey::MintingFrozen, &true);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        MintingFrozenEvent {
            sequence: next_sequence,
            frozen_by: caller,
        }
        .publish(&env);

        Ok(())
    }

    // ====================================================================
    // Getters
    // ====================================================================

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }

    /// Returns the proposed successor admin while a transfer is in flight,
    /// or None if there is no pending proposal.
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    pub fn get_name(env: Env) -> Result<String, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_symbol(env: Env) -> Result<String, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(0u32)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap()
    }

    pub fn get_retirement_tracker(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::RetirementTracker)
            .ok_or(ContractError::NotInitialized)
    }

    pub fn get_regulatory_check(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::RegulatoryCheck)
    }

    pub fn get_host_jurisdiction(env: Env) -> Option<String> {
        env.storage().instance().get(&DataKey::HostJurisdiction)
    }

    pub fn get_oracle(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Oracle)
    }

    pub fn get_event_sequence(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64)
    }

    /// Returns the configured maximum supply cap, or None if no cap has been set.
    pub fn get_max_supply(env: Env) -> Option<u32> {
        env.storage().instance().get(&DataKey::MaxSupply)
    }

    /// Returns the total number of tokens minted so far.
    pub fn get_total_minted(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0u32)
    }

    /// Returns the number of tokens that can still be minted before the cap is
    /// reached. Returns None if no cap has been configured.
    pub fn get_remaining_supply(env: Env) -> Option<u32> {
        let max_supply: Option<u32> = env.storage().instance().get(&DataKey::MaxSupply);
        max_supply.map(|cap| {
            let minted: u32 = env
                .storage()
                .instance()
                .get(&DataKey::TotalMinted)
                .unwrap_or(0u32);
            if minted >= cap {
                0u32
            } else {
                cap - minted
            }
        })
    }

    /// Returns true if minting has been permanently frozen by the admin.
    pub fn is_minting_frozen(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::MintingFrozen)
            .unwrap_or(false)
    }

    pub fn owner_of(env: Env, token_id: u32) -> Result<Address, ContractError> {
        let burned: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Burned(token_id))
            .unwrap_or(false);
        if burned {
            return Err(ContractError::TokenNotFound);
        }
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .ok_or(ContractError::TokenNotFound)
    }

    pub fn get_metadata(env: Env, token_id: u32) -> Result<CarbonAssetMetadata, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Metadata(token_id))
            .ok_or(ContractError::TokenNotFound)
    }

    pub fn get_status(env: Env, token_id: u32) -> Result<AssetStatus, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Status(token_id))
            .ok_or(ContractError::TokenNotFound)
    }

    pub fn get_quality_score(env: Env, token_id: u32) -> Result<i128, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::QualityScore(token_id))
            .ok_or(ContractError::TokenNotFound)
    }

    pub fn balance_of(env: Env, owner: Address) -> i128 {
        let tokens: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner))
            .unwrap_or(Vec::new(&env));
        tokens.len() as i128
    }

    pub fn tokens_of_owner(env: Env, owner: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner))
            .unwrap_or(Vec::new(&env))
    }

    pub fn is_burned(env: Env, token_id: u32) -> Result<bool, ContractError> {
        Self::get_status(env.clone(), token_id)?;
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Burned(token_id))
            .unwrap_or(false))
    }

    fn transfer_token_internal(
        env: Env,
        from: Address,
        to: Address,
        token_id: u32,
        require_auth: bool,
    ) -> Result<(), ContractError> {
        if require_auth {
            from.require_auth();
        }

        let owner = Self::owner_of(env.clone(), token_id)?;
        if owner != from {
            return Err(ContractError::NotOwner);
        }

        let burned = Self::is_burned(env.clone(), token_id)?;
        if burned {
            return Err(ContractError::TokenAlreadyBurned);
        }

        let status = Self::get_status(env.clone(), token_id)?;
        if status != AssetStatus::Issued && status != AssetStatus::Listed {
            return Err(ContractError::TransferNotAllowed);
        }

        // The `?` here already propagates ComplianceCallFailed (or any other
        // ContractError from before_transfer's own storage lookups)
        // transparently — only an `Ok(false)` (the call succeeded and
        // responded non-compliant) reaches this explicit ComplianceFailed.
        if !Self::before_transfer(env.clone(), from.clone(), to.clone(), token_id)? {
            return Err(ContractError::ComplianceFailed);
        }

        Self::remove_token_from_owner(env.clone(), from.clone(), token_id)?;
        Self::add_token_to_owner(env.clone(), to.clone(), token_id);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        TransferEvent {
            sequence: next_sequence,
            token_id,
            from: from.clone(),
            to: to.clone(),
        }
        .publish(&env);

        let retirement_tracker = Self::get_retirement_tracker(env.clone())?;
        if to == retirement_tracker {
            Self::set_status_internal(env, token_id, AssetStatus::Retired, from)?;
        }

        Ok(())
    }

    fn transfer_amount_internal(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        if amount <= 0 {
            return Err(ContractError::InvalidStatusTransition);
        }

        let token_ids = Self::collect_transferable_tokens(env.clone(), from.clone(), amount)?;
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            Self::transfer_token_internal(env.clone(), from.clone(), to.clone(), token_id, false)?;
        }

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        Sep41TransferEvent { sequence: next_sequence, from, to, amount }.publish(&env);

        Ok(())
    }

    fn burn_amount_internal(
        env: Env,
        from: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        if amount <= 0 {
            return Err(ContractError::InvalidStatusTransition);
        }

        let token_ids = Self::collect_retired_tokens(env.clone(), from.clone(), amount)?;
        for i in 0..token_ids.len() {
            let token_id = token_ids.get(i).unwrap();
            Self::burn_token(env.clone(), token_id, from.clone())?;
        }

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        Sep41BurnEvent { sequence: next_sequence, from, amount }.publish(&env);

        Ok(())
    }

    fn collect_transferable_tokens(
        env: Env,
        owner: Address,
        amount: i128,
    ) -> Result<Vec<u32>, ContractError> {
        let tokens: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner))
            .unwrap_or(Vec::new(&env));

        let mut transferable = Vec::new(&env);
        for i in 0..tokens.len() {
            let token_id = tokens.get(i).unwrap();
            let burned = Self::is_burned(env.clone(), token_id)?;
            if burned {
                continue;
            }
            let status = Self::get_status(env.clone(), token_id)?;
            if status == AssetStatus::Issued || status == AssetStatus::Listed {
                transferable.push_back(token_id);
            }
            if transferable.len() as i128 == amount {
                break;
            }
        }

        if transferable.len() as i128 != amount {
            return Err(ContractError::TransferNotAllowed);
        }

        Ok(transferable)
    }

    fn collect_retired_tokens(
        env: Env,
        owner: Address,
        amount: i128,
    ) -> Result<Vec<u32>, ContractError> {
        let tokens: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner))
            .unwrap_or(Vec::new(&env));

        let mut retired = Vec::new(&env);
        for i in 0..tokens.len() {
            let token_id = tokens.get(i).unwrap();
            let burned = Self::is_burned(env.clone(), token_id)?;
            if burned {
                continue;
            }
            let status = Self::get_status(env.clone(), token_id)?;
            if status == AssetStatus::Retired {
                retired.push_back(token_id);
            }
            if retired.len() as i128 == amount {
                break;
            }
        }

        if retired.len() as i128 != amount {
            return Err(ContractError::TransferNotAllowed);
        }

        Ok(retired)
    }

    // ====================================================================
    // Internal Helpers
    // ====================================================================

    fn set_status_internal(
        env: Env,
        token_id: u32,
        new_status: AssetStatus,
        changed_by: Address,
    ) -> Result<(), ContractError> {
        let current = Self::get_status(env.clone(), token_id)?;
        if current == new_status {
            return Ok(());
        }

        env.storage()
            .persistent()
            .set(&DataKey::Status(token_id), &new_status);

        let sequence: u64 = env
            .storage()
            .instance()
            .get(&DataKey::EventSequence)
            .unwrap_or(0u64);
        let next_sequence = sequence + 1;
        env.storage()
            .instance()
            .set(&DataKey::EventSequence, &next_sequence);
        StatusChangeEvent {
            sequence: next_sequence,
            token_id,
            old_status: Some(current),
            new_status,
            changed_by,
        }
        .publish(&env);

        Ok(())
    }

    fn add_token_to_owner(env: Env, owner: Address, token_id: u32) {
        let mut tokens: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner.clone()))
            .unwrap_or(Vec::new(&env));

        tokens.push_back(token_id);
        let index = tokens.len() - 1;
        env.storage()
            .persistent()
            .set(&DataKey::OwnerTokens(owner), &tokens);
        env.storage()
            .persistent()
            .set(&DataKey::TokenIndex(token_id), &index);
    }

    fn remove_token_from_owner(
        env: Env,
        owner: Address,
        token_id: u32,
    ) -> Result<(), ContractError> {
        let mut tokens: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner.clone()))
            .ok_or(ContractError::TokenNotFound)?;

        let index: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::TokenIndex(token_id))
            .ok_or(ContractError::TokenNotFound)?;

        if tokens.len() == 0 {
            return Err(ContractError::TokenNotFound);
        }

        let last_index = tokens.len() - 1;
        let last_token = tokens.get(last_index).ok_or(ContractError::TokenNotFound)?;

        if index != last_index {
            tokens.set(index, last_token);
            env.storage()
                .persistent()
                .set(&DataKey::TokenIndex(last_token), &index);
        }

        tokens.pop_back();
        if tokens.len() == 0 {
            env.storage().persistent().remove(&DataKey::OwnerTokens(owner));
        } else {
            env.storage()
                .persistent()
                .set(&DataKey::OwnerTokens(owner), &tokens);
        }

        env.storage()
            .persistent()
            .remove(&DataKey::TokenIndex(token_id));

        Ok(())
    }

    fn spend_allowance(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
    ) -> Result<AllowanceData, ContractError> {
        let key = DataKey::Allowance(from, spender);
        let mut allowance = env
            .storage()
            .persistent()
            .get::<DataKey, AllowanceData>(&key)
            .unwrap_or(AllowanceData {
                amount: 0,
                live_until_ledger: 0,
            });

        if allowance.live_until_ledger < env.ledger().sequence() {
            allowance.amount = 0;
        }

        if allowance.amount < amount {
            return Err(ContractError::NotAuthorized);
        }

        allowance.amount -= amount;
        Ok(allowance)
    }
}
