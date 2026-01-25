#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String, Vec,
};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum OperationType {
    TRANSFER,
    RETIREMENT,
}

#[derive(Clone)]
#[contracttype]
pub struct JurisdictionRule {
    pub rule_id: String,
    pub description: String,
    pub source_jur: String,
    pub dest_jur: String,
    pub host_jur: String,
    pub operation: OperationType,
    pub is_allowed: bool,
    pub required_authority: Option<Address>,
}

#[derive(Clone)]
#[contracttype]
pub struct ValidationResult {
    pub is_compliant: bool,
    pub rule_id: Option<String>,
    pub requires_authorization: bool,
    pub authority_address: Option<Address>,
    pub error_message: Option<String>,
}

#[derive(Clone)]
#[contracttype]
pub struct PendingApproval {
    pub token_id: u32,
    pub source: Address,
    pub destination: Address,
    pub operation: OperationType,
    pub timestamp: u64,
    pub approved: bool,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governance,
    CarbonAssetContract,
    Rule(String),
    ActiveRuleIds,
    AddressJurisdiction(Address),
    PendingApproval(BytesN<32>),
}

#[derive(Clone, Copy)]
#[contracterror]
pub enum ContractError {
    NotAuthorized = 1,
    RuleNotFound = 2,
    RuleAlreadyExists = 3,
    JurisdictionNotSet = 4,
    InvalidApprovalKey = 5,
    ApprovalExpired = 6,
    NoMatchingRule = 7,
}

#[contract]
pub struct RegulatoryCheck;

#[contractimpl]
impl RegulatoryCheck {
    /// Initialize the contract
    pub fn initialize(
        env: Env,
        admin: Address,
        governance: Address,
        carbon_asset_contract: Address,
    ) {
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
    }

    // ========================================================================
    // Rule Management
    // ========================================================================

    /// Add a new jurisdiction rule
    pub fn add_rule(
        env: Env,
        caller: Address,
        rule: JurisdictionRule,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env.storage().instance().get(&DataKey::Governance).unwrap();

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        let rule_key = DataKey::Rule(rule.rule_id.clone());

        // Check if rule already exists
        if env.storage().persistent().has(&rule_key) {
            return Err(ContractError::RuleAlreadyExists);
        }

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

        Ok(())
    }

    /// Update an existing rule
    pub fn update_rule(
        env: Env,
        caller: Address,
        rule: JurisdictionRule,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env.storage().instance().get(&DataKey::Governance).unwrap();

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        let rule_key = DataKey::Rule(rule.rule_id.clone());

        if !env.storage().persistent().has(&rule_key) {
            return Err(ContractError::RuleNotFound);
        }

        env.storage().persistent().set(&rule_key, &rule);

        Ok(())
    }

    /// Deactivate a rule
    pub fn deactivate_rule(
        env: Env,
        caller: Address,
        rule_id: String,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let governance: Address = env.storage().instance().get(&DataKey::Governance).unwrap();

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        let rule_key = DataKey::Rule(rule_id.clone());

        if !env.storage().persistent().has(&rule_key) {
            return Err(ContractError::RuleNotFound);
        }

        env.storage().persistent().remove(&rule_key);

        let active_rules: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap();

        let mut new_rules = Vec::new(&env);
        for i in 0..active_rules.len() {
            let rid = active_rules.get(i).unwrap();
            if rid != rule_id {
                new_rules.push_back(rid);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::ActiveRuleIds, &new_rules);

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

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

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

        // Get active rules
        let active_rules: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env));

        // Find matching rule
        for i in 0..active_rules.len() {
            let rule_id = active_rules.get(i).unwrap();
            let rule_key = DataKey::Rule(rule_id.clone());

            if let Some(rule) = env
                .storage()
                .persistent()
                .get::<DataKey, JurisdictionRule>(&rule_key)
            {
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
            // Check if not expired and approved
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

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

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

        let governance: Address = env.storage().instance().get(&DataKey::Governance).unwrap();

        if caller != governance {
            return Err(ContractError::NotAuthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::Governance, &new_governance);
        Ok(())
    }

    /// Get rule by ID
    pub fn get_rule(env: Env, rule_id: String) -> Option<JurisdictionRule> {
        let key = DataKey::Rule(rule_id);
        env.storage().persistent().get(&key)
    }

    /// Get all active rule IDs
    pub fn get_active_rules(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&DataKey::ActiveRuleIds)
            .unwrap_or(Vec::new(&env))
    }
}
