#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, BytesN, Env, String, Symbol, Vec,
};

mod errors;
mod events;

#[cfg(test)]
mod test;

pub use errors::ContractError;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct TaxAttributeTag {
    pub tag_id: String,
    pub jurisdiction: String,
    pub regulation_code: String,
    pub eligibility_criteria_hash: BytesN<32>,
    pub issuing_authority: Address,
    pub valid_from: u64,
    pub valid_until: u64,
    pub attached_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct IssuerProof {
    pub issuer: Address,
    pub is_authorized: bool,
    pub ledger_sequence: u32,
    pub proof_hash: BytesN<32>,
}

#[contracttype]
pub enum Event {
    IssuerAdded(Address),
    IssuerRemoved(Address),
}

#[contracttype]
pub enum DataKey {
    Admin,                // Address
    Issuer(Address),      // bool
    Attribute(String),    // TaxAttributeTag
    TokenAttributes(u32), // Vec<String> (list of tag_ids)
    AllIssuers,           // Vec<Address>
}

#[contract]
pub struct TaxAttributeContract;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AttributeDefinition {
    pub tag_id: String,
    pub jurisdiction: String,
    pub regulation_code: String,
    pub eligibility_criteria_hash: BytesN<32>,
    pub valid_from: u64,
    pub valid_until: u64,
}

#[contractimpl]
impl TaxAttributeContract {
    /// View function returning true if contract is initialized.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    /// One-time contract initialization.
    /// Returns ContractError::AlreadyInitialized on re-initialization attempts.
    pub fn init(env: Env, admin: Address) -> Result<(), ContractError> {
        if Self::is_initialized(env.clone()) {
            events::emit_reinitialization_attempted_event(&env, admin);
            return Err(ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        let empty_issuers: Vec<Address> = Vec::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::AllIssuers, &empty_issuers);
        events::emit_initialized_event(&env, admin);
        Ok(())
    }

    pub fn add_issuer(env: Env, issuer: Address) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotAuthorized)?;
        admin.require_auth();

        if !env
            .storage()
            .instance()
            .has(&DataKey::Issuer(issuer.clone()))
        {
            env.storage()
                .instance()
                .set(&DataKey::Issuer(issuer.clone()), &true);

            let mut all_issuers: Vec<Address> = env
                .storage()
                .instance()
                .get(&DataKey::AllIssuers)
                .unwrap_or(Vec::new(&env));
            all_issuers.push_back(issuer.clone());
            env.storage()
                .instance()
                .set(&DataKey::AllIssuers, &all_issuers);

            #[allow(deprecated)]
            env.events().publish((Symbol::short("iss_add"),), issuer.clone());
        }
        Ok(())
    }

    pub fn remove_issuer(env: Env, issuer: Address) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotAuthorized)?;
        admin.require_auth();

        if env
            .storage()
            .instance()
            .has(&DataKey::Issuer(issuer.clone()))
        {
            env.storage()
                .instance()
                .remove(&DataKey::Issuer(issuer.clone()));

            let mut all_issuers: Vec<Address> = env
                .storage()
                .instance()
                .get(&DataKey::AllIssuers)
                .unwrap_or(Vec::new(&env));
            let index = all_issuers.first_index_of(&issuer);
            if let Some(i) = index {
                all_issuers.remove(i);
                env.storage()
                    .instance()
                    .set(&DataKey::AllIssuers, &all_issuers);
            }

            #[allow(deprecated)]
            env.events().publish((Symbol::short("iss_rem"),), issuer.clone());
        }
        Ok(())
    }

    pub fn attach_tax_attribute(
        env: Env,
        issuer: Address,
        token_id: u32,
        definition: AttributeDefinition,
    ) -> Result<(), ContractError> {
        issuer.require_auth();

        // Verify issuer is authorized
        if !env
            .storage()
            .instance()
            .has(&DataKey::Issuer(issuer.clone()))
        {
            return Err(ContractError::NotAuthorizedIssuer);
        }

        // Verify the attribute window is not already expired
        let current_time = env.ledger().timestamp();
        if current_time > definition.valid_until {
            return Err(ContractError::AttributeExpired);
        }

        // Verify tag_id uniqueness
        if env
            .storage()
            .persistent()
            .has(&DataKey::Attribute(definition.tag_id.clone()))
        {
            return Err(ContractError::AttributeAlreadyExists);
        }

        let attribute = TaxAttributeTag {
            tag_id: definition.tag_id.clone(),
            jurisdiction: definition.jurisdiction,
            regulation_code: definition.regulation_code,
            eligibility_criteria_hash: definition.eligibility_criteria_hash,
            issuing_authority: issuer,
            valid_from: definition.valid_from,
            valid_until: definition.valid_until,
            attached_at: current_time,
        };

        // Store attribute
        env.storage()
            .persistent()
            .set(&DataKey::Attribute(definition.tag_id.clone()), &attribute);

        // Update token attachments
        let mut attached_tags: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::TokenAttributes(token_id))
            .unwrap_or(Vec::new(&env));

        attached_tags.push_back(definition.tag_id);
        env.storage()
            .persistent()
            .set(&DataKey::TokenAttributes(token_id), &attached_tags);

        Ok(())
    }

    pub fn revoke_attribute(
        env: Env,
        caller: Address,
        token_id: u32,
        tag_id: String,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        // Load attribute
        let key = DataKey::Attribute(tag_id.clone());
        if !env.storage().persistent().has(&key) {
            return Err(ContractError::AttributeNotFound);
        }
        let attribute: TaxAttributeTag = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(ContractError::AttributeNotFound)?;

        // Check auth: Admin or Original Issuer
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotAuthorized)?;
        if caller != admin && caller != attribute.issuing_authority {
            return Err(ContractError::NotAuthorized);
        }

        let mut attached_tags: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::TokenAttributes(token_id))
            .unwrap_or(Vec::new(&env));

        let index = attached_tags.first_index_of(&tag_id);
        if let Some(i) = index {
            attached_tags.remove(i);
            env.storage()
                .persistent()
                .set(&DataKey::TokenAttributes(token_id), &attached_tags);
            Ok(())
        } else {
            Err(ContractError::AttributeNotAttached)
        }
    }

    pub fn get_attributes_for_token(env: Env, token_id: u32) -> Vec<TaxAttributeTag> {
        let attached_tags: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::TokenAttributes(token_id))
            .unwrap_or(Vec::new(&env));

        let mut result: Vec<TaxAttributeTag> = Vec::new(&env);
        let now = env.ledger().timestamp();

        for tag_id in attached_tags.iter() {
            if let Some(attribute) = env
                .storage()
                .persistent()
                .get::<DataKey, TaxAttributeTag>(&DataKey::Attribute(tag_id))
            {
                if now >= attribute.valid_from && now <= attribute.valid_until {
                    result.push_back(attribute);
                }
            }
        }
        result
    }

    pub fn is_token_eligible(
        env: Env,
        token_id: u32,
        jurisdiction: String,
        regulation_code: String,
    ) -> bool {
        let attributes = Self::get_attributes_for_token(env.clone(), token_id);
        for attribute in attributes.iter() {
            if attribute.jurisdiction == jurisdiction
                && attribute.regulation_code == regulation_code
            {
                return true;
            }
        }
        false
    }

    pub fn get_issuing_authorities(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AllIssuers)
            .unwrap_or(Vec::new(&env))
    }

    pub fn generate_issuer_proof(env: Env, issuer: Address) -> IssuerProof {
        let is_authorized = env
            .storage()
            .instance()
            .has(&DataKey::Issuer(issuer.clone()));

        let ledger_sequence = env.ledger().sequence();

        let hash_input = (ledger_sequence as u64) * 1000 + (if is_authorized { 1u64 } else { 0u64 });

        let hash_bytes = hash_input.to_be_bytes();
        let mut proof_bytes = [0u8; 32];
        for i in 0..8 {
            proof_bytes[i] = hash_bytes[i];
        }

        let proof_hash = BytesN::from_array(&env, &proof_bytes);

        IssuerProof {
            issuer,
            is_authorized,
            ledger_sequence,
            proof_hash,
        }
    }

    pub fn generate_batch_issuer_proofs(env: Env, issuers: Vec<Address>) -> Vec<IssuerProof> {
        let mut proofs: Vec<IssuerProof> = Vec::new(&env);
        for issuer in issuers.iter() {
            proofs.push_back(Self::generate_issuer_proof(env.clone(), issuer));
        }
        proofs
    }

    pub fn verify_issuer_proof(env: Env, proof: IssuerProof) -> bool {
        let computed_proof = Self::generate_issuer_proof(env, proof.issuer.clone());

        if computed_proof.proof_hash != proof.proof_hash {
            return false;
        }

        if computed_proof.is_authorized != proof.is_authorized {
            return false;
        }

        if computed_proof.ledger_sequence != proof.ledger_sequence {
            return false;
        }

        true
    }
}
