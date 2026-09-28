#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

mod errors;
mod events;
mod storage;

#[cfg(test)]
mod test;

pub use errors::ContractError;
pub use storage::{DataKey, JurisdictionRule, OperationType, PendingApproval, ValidationResult};

#[contract]
pub struct RegulatoryCheck;

#[contractimpl]
impl RegulatoryCheck {
    /// Returns true if the contract has been initialized.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    /// One-time initialization of the contract.
    /// Sets admin, governance, carbon_asset_contract, and active rules storage.
    /// Returns ContractError::AlreadyInitialized if called more than once.
    pub fn initialize(
        env: Env,
        admin: Address,
        governance: Address,
        carbon_asset_contract: Address,
    ) -> Result<(), ContractError> {
        if Self::is_initialized(env.clone()) {
            events::emit_reinitialization_attempted_event(&env, admin);
            return Err(ContractError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Governance, &governance);
        env.storage()
            .instance()
            .set(&DataKey::CarbonAssetContract, &carbon_asset_contract);

        // Initialize empty active rules list
        let active_rules: Vec<String> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::ActiveRuleIds, &active_rules);

        events::emit_initialized_event(&env, admin, governance, carbon_asset_contract);

        Ok(())
    }

    // ========================================================================
    // Rule Management
    // ========================================================================

    /// Add a new jurisdiction rule
    /// Emits a RuleAdded event after the rule is stored successfully.
    pub fn add_rule(
        env: Env,
        caller: Address,
        rule: JurisdictionRule,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governance)
            .ok_or(ContractError::NotInitialized)?;

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        let rule_key = DataKey::Rule(rule.rule_id.clone());

        // Check if rule_id already exists
        if env.storage().persistent().has(&rule_key) {
            return Err(ContractError::RuleAlreadyExists);
        }

        // Check for logical duplicate/conflict
        let active_rules: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env));
        for rid in active_rules.iter() {
            let existing_key = DataKey::Rule(rid.clone());
            if let Some(existing_rule) = env
                .storage()
                .persistent()
                .get::<DataKey, JurisdictionRule>(&existing_key)
            {
                if Self::rules_conflict(&rule, &existing_rule) {
                    soroban_sdk::log!(
                        &env,
                        "Rule conflict: attempted to add rule {:?} which conflicts with existing rule {:?}",
                        rule,
                        existing_rule
                    );
                    return Err(ContractError::RuleConflict);
                }
            }
        }

        // Version numbering is contract-controlled: a brand-new rule always
        // starts at version 1, regardless of whatever value the caller put
        // in `rule.version`.
        let mut rule = rule;
        rule.version = 1;
        env.storage()
            .persistent()
            .set(&DataKey::RuleVersion(rule.rule_id.clone()), &1u32);

        // Store the rule
        env.storage().persistent().set(&rule_key, &rule);

        // Add to active rules list
        let mut active_rules: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env));
        active_rules.push_back(rule.rule_id.clone());
        env.storage()
            .instance()
            .set(&DataKey::ActiveRuleIds, &active_rules);

        // Emit RuleAdded event after state changes
        events::emit_rule_added_event(
            &env,
            rule.rule_id.clone(),
            rule.source_jur.clone(),
            rule.dest_jur.clone(),
            rule.host_jur.clone(),
            rule.operation,
            rule.is_allowed,
            rule.required_authority,
            caller,
        );

        Ok(())
    }

    /// Returns true if two rules are logically equivalent or would cause enforcement ambiguity.
    fn rules_conflict(a: &JurisdictionRule, b: &JurisdictionRule) -> bool {
        a.source_jur == b.source_jur
            && a.dest_jur == b.dest_jur
            && a.host_jur == b.host_jur
            && a.operation == b.operation
            && a.is_allowed == b.is_allowed
            && a.required_authority == b.required_authority
    }

    /// Update an existing rule
    /// Emits a RuleUpdated event after the rule is updated.
    pub fn update_rule(
        env: Env,
        caller: Address,
        rule: JurisdictionRule,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governance)
            .ok_or(ContractError::NotInitialized)?;

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        let rule_key = DataKey::Rule(rule.rule_id.clone());

        // Retrieve the old rule before updating
        let old_rule: JurisdictionRule = env
            .storage()
            .persistent()
            .get(&rule_key)
            .ok_or(ContractError::RuleNotFound)?;

        // Check for logical duplicate/conflict against other *active* rules
        // (excluding this rule's own current entry — updating a rule to its
        // own unchanged content, or to a new state that just happens to
        // resemble its own prior content, is not a conflict).
        let active_rules: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env));
        for rid in active_rules.iter() {
            if rid == rule.rule_id {
                continue;
            }
            let existing_key = DataKey::Rule(rid.clone());
            if let Some(existing_rule) = env
                .storage()
                .persistent()
                .get::<DataKey, JurisdictionRule>(&existing_key)
            {
                if Self::rules_conflict(&rule, &existing_rule) {
                    soroban_sdk::log!(
                        &env,
                        "Rule conflict: attempted to update rule {:?} into a state that conflicts with existing rule {:?}",
                        rule,
                        existing_rule
                    );
                    return Err(ContractError::RuleConflict);
                }
            }
        }

        // Compute hashes for change detection before overwriting
        let old_rule_hash = events::compute_rule_hash(&env, &old_rule);

        // Archive the pre-update content under its own version number
        // (#565) — the prior content is retained on-chain, not only its
        // hash in the emitted event, so it remains queryable via
        // get_rule_history/get_rule_at_version for audit/legal traceability.
        env.storage().persistent().set(
            &DataKey::RuleHistory(rule.rule_id.clone(), old_rule.version),
            &old_rule,
        );

        // Version numbering is contract-controlled: always the prior
        // version + 1, regardless of whatever value the caller put in
        // `rule.version`.
        let new_version = old_rule.version + 1;
        let mut rule = rule;
        rule.version = new_version;
        env.storage()
            .persistent()
            .set(&DataKey::RuleVersion(rule.rule_id.clone()), &new_version);

        let new_rule_hash = events::compute_rule_hash(&env, &rule);

        // Store the updated rule
        env.storage().persistent().set(&rule_key, &rule);

        // Emit RuleUpdated event after state change
        events::emit_rule_updated_event(
            &env,
            rule.rule_id.clone(),
            old_rule_hash,
            new_rule_hash,
            caller,
        );

        Ok(())
    }

    /// Deactivate a rule
    /// Emits a RuleDeactivated event after the rule is removed.
    pub fn deactivate_rule(
        env: Env,
        caller: Address,
        rule_id: String,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governance)
            .ok_or(ContractError::NotInitialized)?;

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        let rule_key = DataKey::Rule(rule_id.clone());

        let current_rule: JurisdictionRule = env
            .storage()
            .persistent()
            .get(&rule_key)
            .ok_or(ContractError::RuleNotFound)?;

        // Archive the final content instead of erasing it (#565) — the rule
        // is no longer active/enforceable, but its content remains
        // queryable via get_rule_history/get_rule_at_version.
        // DataKey::RuleVersion(rule_id) is deliberately left in place (not
        // removed alongside rule_key) so that lookup keeps working after
        // deactivation.
        env.storage().persistent().set(
            &DataKey::RuleHistory(rule_id.clone(), current_rule.version),
            &current_rule,
        );

        // Remove the rule
        env.storage().persistent().remove(&rule_key);

        // Remove from active rules list
        let active_rules: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env));

        let mut new_rules = Vec::new(&env);
        for rid in active_rules.iter() {
            if rid != rule_id {
                new_rules.push_back(rid);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::ActiveRuleIds, &new_rules);

        // Emit RuleDeactivated event after state changes
        events::emit_rule_deactivated_event(&env, rule_id, caller);

        Ok(())
    }

    // ========================================================================
    // Jurisdiction Management
    // ========================================================================

    /// Set jurisdiction for an address
    pub fn set_address_jurisdiction(
        env: Env,
        caller: Address,
        account: Address,
        jurisdiction: String,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        let key = DataKey::AddressJurisdiction(account);
        env.storage().persistent().set(&key, &jurisdiction);

        Ok(())
    }

    /// Get jurisdiction for an address
    pub fn get_address_jurisdiction(env: Env, account: Address) -> Option<String> {
        let key = DataKey::AddressJurisdiction(account);
        env.storage().persistent().get(&key)
    }

    // ========================================================================
    // Compliance Validation
    // ========================================================================

    /// Primary validation function called by CarbonAsset contract
    pub fn validate_transaction(
        env: Env,
        source_address: Address,
        destination_address: Address,
        operation: OperationType,
        host_jurisdiction: String,
    ) -> ValidationResult {
        let source_jur = Self::get_address_jurisdiction(env.clone(), source_address.clone());

        let dest_jur = Self::get_address_jurisdiction(env.clone(), destination_address.clone());

        if source_jur.is_none() || dest_jur.is_none() {
            return ValidationResult {
                is_compliant: false,
                rule_id: None,
                requires_authorization: false,
                authority_address: None,
                error_message: Some(String::from_str(&env, "Jurisdiction not set for address")),
            };
        }

        let source_jur = source_jur.unwrap();
        let dest_jur = dest_jur.unwrap();

        // Evaluate rules in explicit priority order rather than the order they
        // happened to be inserted into ActiveRuleIds, so the governing rule for
        // a transaction is a property of the rule set and not of its history.
        let ordered_rules = Self::rules_in_priority_order(&env);

        // Find matching rule
        for rule in ordered_rules.iter() {
            if Self::rule_matches(
                &env,
                &rule,
                &source_jur,
                &dest_jur,
                &host_jurisdiction,
                &operation,
            ) {
                // Rule matched
                if rule.is_allowed {
                    if let Some(authority) = rule.required_authority.clone() {
                        // Requires authorization
                        return ValidationResult {
                            is_compliant: true,
                            rule_id: Some(rule.rule_id.clone()),
                            requires_authorization: true,
                            authority_address: Some(authority),
                            error_message: None,
                        };
                    } else {
                        // Allowed without authorization
                        return ValidationResult {
                            is_compliant: true,
                            rule_id: Some(rule.rule_id.clone()),
                            requires_authorization: false,
                            authority_address: None,
                            error_message: None,
                        };
                    }
                } else {
                    // Explicitly prohibited
                    return ValidationResult {
                        is_compliant: false,
                        rule_id: Some(rule.rule_id.clone()),
                        requires_authorization: false,
                        authority_address: None,
                        error_message: Some(String::from_str(
                            &env,
                            "Transaction prohibited by rule",
                        )),
                    };
                }
            }
        }

        // No matching rule found - default to non-compliant
        ValidationResult {
            is_compliant: false,
            rule_id: None,
            requires_authorization: false,
            authority_address: None,
            error_message: Some(String::from_str(&env, "No matching rule found")),
        }
    }

    // ========================================================================
    // Authority Approval
    // ========================================================================

    /// Record authorization from required authority
    pub fn record_authorization(
        env: Env,
        authority: Address,
        approval_key: BytesN<32>,
    ) -> Result<(), ContractError> {
        authority.require_auth();

        let key = DataKey::PendingApproval(approval_key.clone());

        let mut pending: PendingApproval = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::InvalidApprovalKey)?;

        // Check if expired (7 days = 604800 seconds)
        let current_time = env.ledger().timestamp();
        if current_time > pending.timestamp + 604800 {
            return Err(ContractError::ApprovalExpired);
        }

        // Mark as approved
        pending.approved = true;
        env.storage().persistent().set(&key, &pending);

        Ok(())
    }

    /// Create pending approval request
    pub fn create_pending_approval(
        env: Env,
        approval_key: BytesN<32>,
        token_id: u32,
        source: Address,
        destination: Address,
        operation: OperationType,
    ) {
        let pending = PendingApproval {
            token_id,
            source,
            destination,
            operation,
            timestamp: env.ledger().timestamp(),
            approved: false,
        };

        let key = DataKey::PendingApproval(approval_key);
        env.storage().persistent().set(&key, &pending);
    }

    /// Check if approval exists and is valid
    pub fn check_approval(env: Env, approval_key: BytesN<32>) -> bool {
        let key = DataKey::PendingApproval(approval_key);

        if let Some(pending) = env
            .storage()
            .persistent()
            .get::<DataKey, PendingApproval>(&key)
        {
            let current_time = env.ledger().timestamp();
            pending.approved && current_time <= pending.timestamp + 604800
        } else {
            false
        }
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    fn rule_matches(
        env: &Env,
        rule: &JurisdictionRule,
        source_jur: &String,
        dest_jur: &String,
        host_jur: &String,
        operation: &OperationType,
    ) -> bool {
        let any = String::from_str(env, "ANY");

        if rule.operation != *operation {
            return false;
        }

        if rule.source_jur != any && rule.source_jur != *source_jur {
            return false;
        }

        if rule.dest_jur != any && rule.dest_jur != *dest_jur {
            return false;
        }

        if rule.host_jur != any && rule.host_jur != *host_jur {
            return false;
        }

        true
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /// Update admin address
    pub fn update_admin(
        env: Env,
        caller: Address,
        new_admin: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        if caller != admin {
            return Err(ContractError::NotAuthorized);
        }

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    /// Update governance address
    pub fn update_governance(
        env: Env,
        caller: Address,
        new_governance: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governance)
            .ok_or(ContractError::NotInitialized)?;

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::Governance, &new_governance);
        Ok(())
    }

    /// Get rule by ID. Returns the current, live rule — `None` once the
    /// rule has been deactivated, even though its content is still
    /// retrievable via `get_rule_history`/`get_rule_at_version` (#565).
    pub fn get_rule(env: Env, rule_id: String) -> Option<JurisdictionRule> {
        let key = DataKey::Rule(rule_id);
        env.storage().persistent().get(&key)
    }

    /// Returns every version of a rule ever seen, oldest first: each
    /// superseded version archived by `update_rule`/`deactivate_rule`,
    /// followed by the current live version if the rule is still active
    /// (#565). Returns an empty vector if `rule_id` has never existed.
    pub fn get_rule_history(env: Env, rule_id: String) -> Vec<JurisdictionRule> {
        let mut history = Vec::new(&env);

        let latest_version: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::RuleVersion(rule_id.clone()))
            .unwrap_or(0);

        for version in 1..=latest_version {
            if let Some(archived) = env
                .storage()
                .persistent()
                .get::<DataKey, JurisdictionRule>(&DataKey::RuleHistory(rule_id.clone(), version))
            {
                history.push_back(archived);
            }
        }

        // The current live version (if the rule is still active) hasn't
        // been archived yet — it only gets archived on the *next*
        // update_rule/deactivate_rule call — so append it explicitly.
        if let Some(current) = env
            .storage()
            .persistent()
            .get::<DataKey, JurisdictionRule>(&DataKey::Rule(rule_id))
        {
            history.push_back(current);
        }

        history
    }

    /// Resolves a rule's content as of a specific version number, whether
    /// that version is the current live one or an archived, superseded one
    /// (#565). Returns `None` if `rule_id` never had that version.
    pub fn get_rule_at_version(
        env: Env,
        rule_id: String,
        version: u32,
    ) -> Option<JurisdictionRule> {
        if let Some(current) = env
            .storage()
            .persistent()
            .get::<DataKey, JurisdictionRule>(&DataKey::Rule(rule_id.clone()))
        {
            if current.version == version {
                return Some(current);
            }
        }

        env.storage()
            .persistent()
            .get(&DataKey::RuleHistory(rule_id, version))
    }

    /// Get all active rule IDs, in raw storage-insertion order.
    ///
    /// This is *not* the order rules are evaluated in — see
    /// `get_rules_by_priority` for that.
    pub fn get_active_rules(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the active rules in exactly the order `validate_transaction`
    /// evaluates them: ascending `priority` (lower wins), ties broken by
    /// ascending `rule_id`.
    ///
    /// Operators can call this to audit precedence directly instead of
    /// re-deriving it from insertion order.
    pub fn get_rules_by_priority(env: Env) -> Vec<JurisdictionRule> {
        Self::rules_in_priority_order(&env)
    }

    /// Loads every active rule and returns them in evaluation order.
    ///
    /// Rule IDs with no stored rule are skipped rather than trapping, matching
    /// the tolerance the previous inline loop had for a dangling ID.
    fn rules_in_priority_order(env: &Env) -> Vec<JurisdictionRule> {
        let active_rule_ids: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(env));

        // Insertion sort: the active rule set is small and bounded by
        // governance, and this avoids allocating a scratch buffer in a
        // no_std contract.
        let mut ordered: Vec<JurisdictionRule> = Vec::new(env);
        for rule_id in active_rule_ids.iter() {
            let rule_key = DataKey::Rule(rule_id.clone());
            let rule: JurisdictionRule = match env
                .storage()
                .persistent()
                .get::<DataKey, JurisdictionRule>(&rule_key)
            {
                Some(r) => r,
                None => continue,
            };

            let mut position = ordered.len();
            for index in 0..ordered.len() {
                let existing = match ordered.get(index) {
                    Some(e) => e,
                    None => continue,
                };
                if Self::rule_precedes(&rule, &existing) {
                    position = index;
                    break;
                }
            }
            ordered.insert(position, rule);
        }

        ordered
    }

    /// Returns true when rule `a` must be evaluated before rule `b`.
    ///
    /// Precedence is lower `priority` first; equal priorities are ordered by
    /// ascending `rule_id`. Because `rule_id` is unique across active rules,
    /// this is a total order — two distinct rules can never tie, so the
    /// evaluated sequence is fully deterministic.
    fn rule_precedes(a: &JurisdictionRule, b: &JurisdictionRule) -> bool {
        if a.priority != b.priority {
            return a.priority < b.priority;
        }
        a.rule_id < b.rule_id
    }
}
