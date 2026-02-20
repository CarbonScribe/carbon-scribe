#![no_std]

mod errors;
mod events;
mod storage;
#[cfg(test)]
mod test;

use errors::Error;
use events::*;
use soroban_sdk::{contract, contractimpl, Address, Env, String};
use storage::*;

#[contract]
pub struct BufferPoolContract;

#[contractimpl]
impl BufferPoolContract {
    /// Initialize the buffer pool with admin, governance, and carbon contract addresses.
    /// Can only be called once. Percentage is in basis points (e.g., 500 = 5%).
    pub fn initialize(
        env: Env,
        admin: Address,
        governance: Address,
        carbon_asset_contract: Address,
        initial_percentage: i64,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&storage::ADMIN) {
            return Err(Error::AlreadyExists);
        }

        if !(0..=10000).contains(&initial_percentage) {
            return Err(Error::InvalidPercentage);
        }

        set_admin(&env, &admin);
        set_governance(&env, &governance);
        set_carbon_asset_contract(&env, &carbon_asset_contract);
        set_replenishment_percentage(&env, initial_percentage);
        set_total_value_locked(&env, 0);

        Ok(())
    }

    /// Manually deposit a carbon credit token into the pool.
    /// Only admin or carbon_asset_contract can call this.
    pub fn deposit(
        env: Env,
        caller: Address,
        token_id: u32,
        project_id: String,
    ) -> Result<(), Error> {
        let admin = get_admin(&env);
        let carbon_contract = get_carbon_asset_contract(&env);

        if caller != admin && caller != carbon_contract {
            return Err(Error::Unauthorized);
        }

        caller.require_auth();

        if has_custody_record(&env, token_id) {
            return Err(Error::AlreadyExists);
        }

        let record = CustodyRecord {
            token_id,
            deposited_at: env.ledger().timestamp(),
            depositor: caller.clone(),
            project_id: project_id.clone(),
        };

        set_custody_record(&env, token_id, &record);

        let tvl = get_total_value_locked(&env);
        set_total_value_locked(&env, tvl + 1);

        emit_deposit_event(&env, token_id, &caller, &project_id);

        Ok(())
    }

    /// Governance withdraws a credit from pool to replace an invalidated token.
    pub fn withdraw_to_replace(
        env: Env,
        governance_caller: Address,
        token_id: u32,
        target_invalidated_token: u32,
    ) -> Result<(), Error> {
        let governance = get_governance(&env);

        if governance_caller != governance {
            return Err(Error::Unauthorized);
        }

        governance_caller.require_auth();

        if !has_custody_record(&env, token_id) {
            return Err(Error::TokenNotFound);
        }

        env.storage()
            .persistent()
            .remove(&(storage::CUSTODY, token_id));

        let tvl = get_total_value_locked(&env);
        set_total_value_locked(&env, tvl - 1);

        emit_withdraw_event(&env, token_id, target_invalidated_token, &governance_caller);

        Ok(())
    }

    pub fn auto_deposit(
        env: Env,
        carbon_contract_caller: Address,
        token_id: u32,
        project_id: String,
        _total_minted: u32,
    ) -> Result<bool, Error> {
        let carbon_contract = get_carbon_asset_contract(&env);
        if carbon_contract_caller != carbon_contract {
            return Err(Error::Unauthorized);
        }

        carbon_contract_caller.require_auth();

        let percentage = get_replenishment_percentage(&env);
        let modulo = (10000 / percentage) as u32;

        if token_id % modulo == 0 {
            let record = CustodyRecord {
                token_id,
                deposited_at: env.ledger().timestamp(),
                depositor: carbon_contract_caller,
                project_id: project_id.clone(),
            };

            set_custody_record(&env, token_id, &record);

            let tvl = get_total_value_locked(&env);
            set_total_value_locked(&env, tvl + 1);

            emit_auto_deposit_event(&env, token_id, &project_id);

            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn set_governance_address(
        env: Env,
        current_governance: Address,
        new_governance: Address,
    ) -> Result<(), Error> {
        let governance = get_governance(&env);

        if current_governance != governance {
            return Err(Error::Unauthorized);
        }

        current_governance.require_auth();

        set_governance(&env, &new_governance);

        Ok(())
    }

    pub fn set_replenishment_rate(
        env: Env,
        governance: Address,
        new_percentage: i64,
    ) -> Result<(), Error> {
        let current_governance = get_governance(&env);

        if governance != current_governance {
            return Err(Error::Unauthorized);
        }

        governance.require_auth();

        if !(0..=10000).contains(&new_percentage) {
            return Err(Error::InvalidPercentage);
        }

        set_replenishment_percentage(&env, new_percentage);

        Ok(())
    }

    pub fn get_total_value_locked(env: Env) -> i128 {
        get_total_value_locked(&env)
    }

    pub fn get_custody_record(env: Env, token_id: u32) -> Option<CustodyRecord> {
        get_custody_record(&env, token_id)
    }

    pub fn is_token_in_pool(env: Env, token_id: u32) -> bool {
        has_custody_record(&env, token_id)
    }
}
