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
    ApproveEvent, MintEvent, QualityScoreUpdatedEvent, Sep41BurnEvent, Sep41TransferEvent,
    StatusChangeEvent, TransferEvent,
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

        let token_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .ok_or(ContractError::NotInitialized)?;

        env.storage()
            .instance()
            .set(&DataKey::NextTokenId, &(token_id + 1));

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

        MintEvent {
            token_id,
            owner: owner.clone(),
            project_id: metadata.project_id.clone(),
            vintage_year: metadata.vintage_year,
            methodology_id: metadata.methodology_id,
        }
        .publish(&env);

        StatusChangeEvent {
            token_id,
            old_status: None,
            new_status: AssetStatus::Issued,
            changed_by: caller,
        }
        .publish(&env);

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

        ApproveEvent {
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

        let result: ValidationResult = env.invoke_contract(&contract, &symbol, args);

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

        QualityScoreUpdatedEvent {
            token_id,
            old_score,
            new_score,
            updated_by: caller,
        }
        .publish(&env);

        Ok(())
    }

    // ====================================================================
    // Admin Configuration
    // ====================================================================

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
    // Getters
    // ====================================================================

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
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

        if !Self::before_transfer(env.clone(), from.clone(), to.clone(), token_id)? {
            return Err(ContractError::ComplianceFailed);
        }

        Self::remove_token_from_owner(env.clone(), from.clone(), token_id)?;
        Self::add_token_to_owner(env.clone(), to.clone(), token_id);
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);

        TransferEvent {
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

        Sep41TransferEvent { from, to, amount }.publish(&env);

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

        Sep41BurnEvent { from, amount }.publish(&env);

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

        StatusChangeEvent {
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
