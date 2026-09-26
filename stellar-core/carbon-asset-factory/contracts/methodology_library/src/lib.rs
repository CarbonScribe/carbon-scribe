#![no_std]
#![allow(deprecated)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, Env, String, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    NotAuthorizedAuthority = 4,
    TokenNotFound = 5,
    MetadataMismatch = 6,
    InvalidTransfer = 7,
    ProposalNotFound = 8,
    DelayNotMet = 9,
    ProposalAlreadyExists = 10,
    // Validation errors (11-15)
    InvalidName = 11,
    InvalidVersion = 12,
    InvalidRegistryLink = 13,
    InvalidRegistry = 14,
    MetadataTooLong = 15,
    DuplicateMethodologyIdentity = 16,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MethodologyMeta {
    pub name: String,
    pub version: String,
    pub registry: String,
    pub registry_link: String,
    pub issuing_authority: Address,
    pub ipfs_cid: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalType {
    AddAuthority,
    RemoveAuthority,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthorityProposal {
    pub proposal_type: ProposalType,
    pub authority: Address,
    pub proposed_at: u64,
    pub executable_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    NextTokenId,
    Authorities,
    Methodology(u32),
    Owner(u32),
    Approved(u32),
    DelayPeriod,
    NextProposalId,
    AuthorityProposal(u32),
    // Maps a (name, version, registry) identity triple to the token_id it
    // was minted as, so mint/update can reject duplicate identities.
    IdentityIndex(String, String, String),
}

#[contract]
pub struct MethodologyLibrary;

#[contractimpl]
impl MethodologyLibrary {
   
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String, delay_period: u64) -> Result<(), Error> {

        admin.require_auth();

        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::Name, &name);
        env.storage().persistent().set(&DataKey::Symbol, &symbol);
        env.storage().persistent().set(&DataKey::NextTokenId, &1u32);
        env.storage().persistent().set(&DataKey::Authorities, &Vec::<Address>::new(&env));
        env.storage().persistent().set(&DataKey::DelayPeriod, &delay_period);
        env.storage().persistent().set(&DataKey::NextProposalId, &1u32);
        Ok(())
    }

    fn validate_metadata(_env: &Env, meta: &MethodologyMeta) -> Result<(), Error> {
        // Validate name: non-empty, not whitespace-only, max 100 chars
        if meta.name.len() == 0 {
            return Err(Error::InvalidName);
        }
        if meta.name.len() > 100 {
            return Err(Error::MetadataTooLong);
        }
        if Self::is_whitespace_only(&meta.name.to_bytes()) {
            return Err(Error::InvalidName);
        }

        // Validate version: non-empty, semver format (x.y.z), max 20 chars
        if meta.version.len() == 0 {
            return Err(Error::InvalidVersion);
        }
        if meta.version.len() > 20 {
            return Err(Error::MetadataTooLong);
        }
        if Self::is_whitespace_only(&meta.version.to_bytes()) {
            return Err(Error::InvalidVersion);
        }
        if !Self::validate_semver(&meta.version.to_bytes()) {
            return Err(Error::InvalidVersion);
        }

        // Validate registry: non-empty, max 50 chars
        if meta.registry.len() == 0 {
            return Err(Error::InvalidRegistry);
        }
        if meta.registry.len() > 50 {
            return Err(Error::MetadataTooLong);
        }
        if Self::is_whitespace_only(&meta.registry.to_bytes()) {
            return Err(Error::InvalidRegistry);
        }

        // Validate registry_link: non-empty, valid URL, max 255 chars
        if meta.registry_link.len() == 0 {
            return Err(Error::InvalidRegistryLink);
        }
        if meta.registry_link.len() > 255 {
            return Err(Error::MetadataTooLong);
        }
        if Self::is_whitespace_only(&meta.registry_link.to_bytes()) {
            return Err(Error::InvalidRegistryLink);
        }
        if !Self::is_valid_url(&meta.registry_link.to_bytes()) {
            return Err(Error::InvalidRegistryLink);
        }

        Ok(())
    }

    fn identity_key(name: &String, version: &String, registry: &String) -> DataKey {
        DataKey::IdentityIndex(name.clone(), version.clone(), registry.clone())
    }

    fn is_whitespace_only(bytes: &Bytes) -> bool {
        for i in 0..bytes.len() {
            if !bytes.get(i).unwrap().is_ascii_whitespace() {
                return false;
            }
        }
        true
    }

    fn validate_semver(bytes: &Bytes) -> bool {
        let mut dots = 0u32;
        let mut current_len = 0u32;
        for i in 0..bytes.len() {
            let byte = bytes.get(i).unwrap();
            if byte == b'.' {
                if current_len == 0 {
                    return false;
                }
                dots += 1;
                current_len = 0;
            } else if !byte.is_ascii_digit() {
                return false;
            } else {
                current_len += 1;
            }
        }
        current_len > 0 && dots == 2
    }

    fn is_valid_url(bytes: &Bytes) -> bool {
        // Check "https://" prefix (8 bytes)
        let https_prefix = [104u8, 116, 116, 112, 115, 58, 47, 47];
        if bytes.len() >= 8 {
            let mut match_https = true;
            for i in 0..8u32 {
                if bytes.get(i).unwrap() != https_prefix[i as usize] {
                    match_https = false;
                    break;
                }
            }
            if match_https {
                return true;
            }
        }
        // Check "http://" prefix (7 bytes)
        let http_prefix = [104u8, 116, 116, 112, 58, 47, 47];
        if bytes.len() >= 7 {
            for i in 0..7u32 {
                if bytes.get(i).unwrap() != http_prefix[i as usize] {
                    return false;
                }
            }
            return true;
        }
        false
    }

    pub fn mint_methodology(env: Env, caller: Address, owner: Address, meta: MethodologyMeta) -> Result<u32, Error> {
        caller.require_auth();

        // Validate metadata before storage
        Self::validate_metadata(&env, &meta)?;

        let authorities: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Authorities)
            .unwrap_or_else(|| Vec::new(&env));
        
        if !authorities.contains(&caller) {
            return Err(Error::NotAuthorizedAuthority);
        }

        if meta.issuing_authority != caller {
            return Err(Error::MetadataMismatch);
        }

        let identity_key = Self::identity_key(&meta.name, &meta.version, &meta.registry);
        if env.storage().persistent().has(&identity_key) {
            return Err(Error::DuplicateMethodologyIdentity);
        }

        let token_id: u32 = env.storage().persistent().get(&DataKey::NextTokenId).ok_or(Error::NotInitialized)?;

        env.storage().persistent().set(&DataKey::Methodology(token_id), &meta);
        env.storage().persistent().set(&DataKey::Owner(token_id), &owner);
        env.storage().persistent().set(&identity_key, &token_id);
        env.storage().persistent().set(&DataKey::NextTokenId, &(token_id + 1));

        env.events().publish(
            (symbol_short!("mint"), token_id),
            (caller, owner, meta.name)
        );

        Ok(token_id)
    }

    pub fn update_methodology_metadata(
        env: Env,
        caller: Address,
        token_id: u32,
        meta: MethodologyMeta,
    ) -> Result<(), Error> {
        caller.require_auth();

        // Validate the new metadata
        Self::validate_metadata(&env, &meta)?;

        // Get existing methodology
        let existing = Self::get_methodology_meta(env.clone(), token_id)?;

        // Only the issuing authority can update metadata
        if existing.issuing_authority != caller {
            return Err(Error::Unauthorized);
        }

        let identity_changed = existing.name != meta.name
            || existing.version != meta.version
            || existing.registry != meta.registry;

        if identity_changed {
            let new_identity_key = Self::identity_key(&meta.name, &meta.version, &meta.registry);
            if let Some(colliding_token_id) = env.storage().persistent().get::<DataKey, u32>(&new_identity_key) {
                if colliding_token_id != token_id {
                    return Err(Error::DuplicateMethodologyIdentity);
                }
            }

            let old_identity_key = Self::identity_key(&existing.name, &existing.version, &existing.registry);
            env.storage().persistent().remove(&old_identity_key);
            env.storage().persistent().set(&new_identity_key, &token_id);
        }

        // Update metadata in storage
        env.storage().persistent().set(&DataKey::Methodology(token_id), &meta);

        // Publish update event
        env.events().publish(
            (symbol_short!("meta_upd"), token_id),
            (meta.name, meta.version),
        );

        Ok(())
    }

    pub fn owner_of(env: Env, token_id: u32) -> Result<Address, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .ok_or(Error::TokenNotFound)
    }

    pub fn get_approved(env: Env, token_id: u32) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Approved(token_id))
    }

    pub fn approve(env: Env, caller: Address, to: Option<Address>, token_id: u32) -> Result<(), Error> {
        caller.require_auth();
        let owner = Self::owner_of(env.clone(), token_id)?;
        
        if caller != owner {
            return Err(Error::Unauthorized);
        }

        match &to {
            Some(addr) => env.storage().persistent().set(&DataKey::Approved(token_id), addr),
            None => env.storage().persistent().remove(&DataKey::Approved(token_id)),
        }

        env.events().publish(
            (symbol_short!("approval"), token_id),
            to
        );
        Ok(())
    }

    pub fn transfer_from(env: Env, caller: Address, from: Address, to: Address, token_id: u32) -> Result<(), Error> {
        caller.require_auth();
        let owner = Self::owner_of(env.clone(), token_id)?;

        if owner != from {
            return Err(Error::InvalidTransfer);
        }

        let approved = Self::get_approved(env.clone(), token_id);
        if caller != owner && Some(caller.clone()) != approved {
            return Err(Error::Unauthorized);
        }

        env.storage().persistent().remove(&DataKey::Approved(token_id));
        env.storage().persistent().set(&DataKey::Owner(token_id), &to);

        env.events().publish(
            (symbol_short!("transfer"), token_id),
            (from, to)
        );
        Ok(())
    }

    pub fn get_methodology_meta(env: Env, token_id: u32) -> Result<MethodologyMeta, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Methodology(token_id))
            .ok_or(Error::TokenNotFound)
    }

    pub fn get_token_by_identity(env: Env, name: String, version: String, registry: String) -> Option<u32> {
        let key = Self::identity_key(&name, &version, &registry);
        env.storage().persistent().get(&key)
    }

    pub fn is_valid_methodology(env: Env, token_id: u32) -> bool {
        let meta_res = Self::get_methodology_meta(env.clone(), token_id);
        if let Ok(meta) = meta_res {
            let authorities: Vec<Address> = env
                .storage()
                .persistent()
                .get(&DataKey::Authorities)
                .unwrap_or_else(|| Vec::new(&env));
            authorities.contains(&meta.issuing_authority)
        } else {
            false
        }
    }

    pub fn add_authority(env: Env, admin_caller: Address, authority: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }

        // Default to an empty set when the key has never been written so a
        // missing entry yields a typed Result instead of a host-level panic.
        let mut authorities: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Authorities)
            .unwrap_or_else(|| Vec::new(&env));
        if !authorities.contains(&authority) {
            authorities.push_back(authority.clone());
            env.storage().persistent().set(&DataKey::Authorities, &authorities);
            env.events().publish((symbol_short!("auth_add"),), authority);
        }
        Ok(())
    }

    pub fn propose_add_authority(env: Env, admin_caller: Address, authority: Address) -> Result<u32, Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }

        let authorities: Vec<Address> = env.storage().persistent().get(&DataKey::Authorities).unwrap_or_else(|| Vec::new(&env));
        if authorities.contains(&authority) {
            return Err(Error::ProposalAlreadyExists);
        }

        let delay_period: u64 = env.storage().persistent().get(&DataKey::DelayPeriod).ok_or(Error::NotInitialized)?;
        let current_ledger = env.ledger().sequence() as u64;
        let proposal_id: u32 = env.storage().persistent().get(&DataKey::NextProposalId).ok_or(Error::NotInitialized)?;

        let proposal = AuthorityProposal {
            proposal_type: ProposalType::AddAuthority,
            authority: authority.clone(),
            proposed_at: current_ledger,
            executable_at: current_ledger + delay_period,
        };

        env.storage().persistent().set(&DataKey::AuthorityProposal(proposal_id), &proposal);
        env.storage().persistent().set(&DataKey::NextProposalId, &(proposal_id + 1));

        env.events().publish(
            (symbol_short!("prop_add"),),
            (proposal_id, authority)
        );

        Ok(proposal_id)
    }

    pub fn remove_authority(env: Env, admin_caller: Address, authority: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }

        // Default to an empty set when the key has never been written so a
        // missing entry yields a typed Result instead of a host-level panic.
        // Filtering an empty list produces an empty list, so removing from an
        // unset authority set is a no-op rather than an error.
        let authorities: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Authorities)
            .unwrap_or_else(|| Vec::new(&env));
        let mut new_authorities = Vec::new(&env);
        for auth in authorities.iter() {
            if auth != authority {
                new_authorities.push_back(auth);
            }
        }
        env.storage().persistent().set(&DataKey::Authorities, &new_authorities);
        env.events().publish((symbol_short!("auth_rem"),), authority);
        Ok(())
    }

    pub fn propose_remove_authority(env: Env, admin_caller: Address, authority: Address) -> Result<u32, Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }

        let authorities: Vec<Address> = env.storage().persistent().get(&DataKey::Authorities).unwrap_or_else(|| Vec::new(&env));
        if !authorities.contains(&authority) {
            return Err(Error::NotAuthorizedAuthority);
        }

        let delay_period: u64 = env.storage().persistent().get(&DataKey::DelayPeriod).ok_or(Error::NotInitialized)?;
        let current_ledger = env.ledger().sequence() as u64;
        let proposal_id: u32 = env.storage().persistent().get(&DataKey::NextProposalId).ok_or(Error::NotInitialized)?;

        let proposal = AuthorityProposal {
            proposal_type: ProposalType::RemoveAuthority,
            authority: authority.clone(),
            proposed_at: current_ledger,
            executable_at: current_ledger + delay_period,
        };

        env.storage().persistent().set(&DataKey::AuthorityProposal(proposal_id), &proposal);
        env.storage().persistent().set(&DataKey::NextProposalId, &(proposal_id + 1));

        env.events().publish(
            (symbol_short!("prop_rem"),),
            (proposal_id, authority)
        );

        Ok(proposal_id)
    }

    pub fn execute_authority_change(env: Env, proposal_id: u32) -> Result<(), Error> {
        let proposal: AuthorityProposal = env
            .storage()
            .persistent()
            .get(&DataKey::AuthorityProposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;

        let current_ledger = env.ledger().sequence() as u64;
        if current_ledger < proposal.executable_at {
            return Err(Error::DelayNotMet);
        }

        match proposal.proposal_type {
            ProposalType::AddAuthority => {
                let mut authorities: Vec<Address> = env.storage().persistent().get(&DataKey::Authorities).unwrap_or_else(|| Vec::new(&env));
                if !authorities.contains(&proposal.authority) {
                    authorities.push_back(proposal.authority.clone());
                    env.storage().persistent().set(&DataKey::Authorities, &authorities);
                }
            },
            ProposalType::RemoveAuthority => {
                let authorities: Vec<Address> = env.storage().persistent().get(&DataKey::Authorities).unwrap_or_else(|| Vec::new(&env));
                let mut new_authorities = Vec::new(&env);
                for auth in authorities.iter() {
                    if auth != proposal.authority {
                        new_authorities.push_back(auth);
                    }
                }
                env.storage().persistent().set(&DataKey::Authorities, &new_authorities);
            }
        }

        env.storage().persistent().remove(&DataKey::AuthorityProposal(proposal_id));
        env.events().publish(
            (symbol_short!("exec_chg"),),
            (proposal_id, proposal.authority)
        );

        Ok(())
    }

    pub fn cancel_authority_change(env: Env, admin_caller: Address, proposal_id: u32) -> Result<(), Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }

        let proposal: AuthorityProposal = env
            .storage()
            .persistent()
            .get(&DataKey::AuthorityProposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;

        env.storage().persistent().remove(&DataKey::AuthorityProposal(proposal_id));
        env.events().publish(
            (symbol_short!("cancel_p"),),
            (proposal_id, proposal.authority)
        );

        Ok(())
    }

    pub fn get_pending_proposal(env: Env, proposal_id: u32) -> Result<AuthorityProposal, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::AuthorityProposal(proposal_id))
            .ok_or(Error::ProposalNotFound)
    }

    pub fn get_delay_period(env: Env) -> Result<u64, Error> {
        env.storage().persistent().get(&DataKey::DelayPeriod).ok_or(Error::NotInitialized)
    }

    pub fn set_delay_period(env: Env, admin_caller: Address, new_delay: u64) -> Result<(), Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }
        env.storage().persistent().set(&DataKey::DelayPeriod, &new_delay);
        env.events().publish((symbol_short!("delay_upd"),), new_delay);
        Ok(())
    }

    pub fn transfer_admin(env: Env, admin_caller: Address, new_admin: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }
        env.storage().persistent().set(&DataKey::Admin, &new_admin);
        env.events().publish((symbol_short!("adm_trns"),), (admin_caller, new_admin));
        Ok(())
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{Env, String};

    #[test]
    fn test_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        client.add_authority(&admin, &authority);

        let token_id = client.mint_methodology(&authority, &owner, &meta);
        assert_eq!(token_id, 1);
        assert_eq!(client.owner_of(&token_id), owner);

        let saved_meta = client.get_methodology_meta(&token_id).name;
        assert_eq!(saved_meta, meta.name);

        assert!(client.is_valid_methodology(&token_id));

        // Verify event publishing (uncomment for deeper integration testing)
        // let events = env.events().all();
        // assert!(events.len() >= 3);

        let new_owner = Address::generate(&env);
        client.transfer_from(&owner, &owner, &new_owner, &token_id);
        assert_eq!(client.owner_of(&token_id), new_owner);

        client.remove_authority(&admin, &authority);
        assert!(!client.is_valid_methodology(&token_id));
    }

    #[test]
    fn test_two_step_add_authority() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let new_authority = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        let delay = client.get_delay_period();
        assert_eq!(delay, 7u64);

        let proposal_id = client.propose_add_authority(&admin, &new_authority);
        assert_eq!(proposal_id, 1u32);

        let proposal = client.get_pending_proposal(&proposal_id);
        assert_eq!(proposal.authority, new_authority);
        assert_eq!(proposal.proposal_type, ProposalType::AddAuthority);

        env.ledger().set_sequence_number(8);

        client.execute_authority_change(&proposal_id);

        let result = client.try_get_pending_proposal(&proposal_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_two_step_remove_authority() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        client.add_authority(&admin, &authority);

        let proposal_id = client.propose_remove_authority(&admin, &authority);
        assert_eq!(proposal_id, 1u32);

        let proposal = client.get_pending_proposal(&proposal_id);
        assert_eq!(proposal.authority, authority);
        assert_eq!(proposal.proposal_type, ProposalType::RemoveAuthority);

        env.ledger().set_sequence_number(8);

        client.execute_authority_change(&proposal_id);
    }

    #[test]
    fn test_cancel_authority_proposal() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let new_authority = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        let proposal_id = client.propose_add_authority(&admin, &new_authority);

        client.cancel_authority_change(&admin, &proposal_id);

        let result = client.try_get_pending_proposal(&proposal_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_delay_enforcement() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let new_authority = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        let proposal_id = client.propose_add_authority(&admin, &new_authority);

        let result = client.try_execute_authority_change(&proposal_id);
        assert!(result.is_err());

        env.ledger().set_sequence_number(8);
        client.execute_authority_change(&proposal_id);
    }

    #[test]
    fn test_set_delay_period() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        client.set_delay_period(&admin, &14u64);
        let new_delay = client.get_delay_period();
        assert_eq!(new_delay, 14u64);
    }

    #[test]
    fn test_errors() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let non_authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: non_authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&non_authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::NotAuthorizedAuthority)));
    }

    #[test]
    fn test_validation_empty_name() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, ""),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidName)));
    }

    #[test]
    fn test_validation_whitespace_name() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "   "),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidName)));
    }

    #[test]
    fn test_validation_name_too_long() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), // 101 A's
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::MetadataTooLong)));
    }

    #[test]
    fn test_validation_empty_version() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, ""),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidVersion)));
    }

    #[test]
    fn test_validation_invalid_version_format() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        // Test version without dots
        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "v1"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidVersion)));
    }

    #[test]
    fn test_validation_version_too_long() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let long_version = "1234567890.1234567890.1"; // 22 chars > 20
        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, long_version),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::MetadataTooLong)));
    }

    #[test]
    fn test_validation_empty_registry() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, ""),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidRegistry)));
    }

    #[test]
    fn test_validation_empty_registry_link() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, ""),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidRegistryLink)));
    }

    #[test]
    fn test_validation_invalid_url() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "not-a-url"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidRegistryLink)));
    }

    #[test]
    fn test_validation_registry_link_too_long() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), // 270 chars > 255
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::MetadataTooLong)));
    }

    #[test]
    fn test_validation_registry_too_long() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"), // 51 A's
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::MetadataTooLong)));
    }

    #[test]
    fn test_validation_valid_http_url() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        // http:// URLs should also be accepted
        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "2.1.0"),
            registry: String::from_str(&env, "GOLDSTANDARD"),
            registry_link: String::from_str(&env, "http://goldstandard.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let token_id = client.mint_methodology(&authority, &owner, &meta);
        assert_eq!(token_id, 1);
    }

    #[test]
    fn test_update_methodology_metadata() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let token_id = client.mint_methodology(&authority, &owner, &meta);
        assert_eq!(token_id, 1);

        // Update metadata with new values
        let updated_meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management v2"),
            version: String::from_str(&env, "2.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org/updated"),
            issuing_authority: authority.clone(),
            ipfs_cid: Some(String::from_str(&env, "QmUpdated")),
        };

        client.update_methodology_metadata(&authority, &token_id, &updated_meta);

        let saved_meta = client.get_methodology_meta(&token_id);
        assert_eq!(saved_meta.name, updated_meta.name);
        assert_eq!(saved_meta.version, updated_meta.version);
        assert_eq!(saved_meta.registry_link, updated_meta.registry_link);
        assert_eq!(saved_meta.ipfs_cid, updated_meta.ipfs_cid);
    }

    #[test]
    fn test_update_metadata_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let other = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let token_id = client.mint_methodology(&authority, &owner, &meta);

        // Try to update with a non-authority caller
        let updated_meta = MethodologyMeta {
            name: String::from_str(&env, "Updated Name"),
            version: String::from_str(&env, "2.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_update_methodology_metadata(&other, &token_id, &updated_meta);
        assert_eq!(result, Err(Ok(Error::Unauthorized)));
    }

    #[test]
    fn test_update_metadata_invalid_name() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let token_id = client.mint_methodology(&authority, &owner, &meta);

        // Update with empty name
        let invalid_meta = MethodologyMeta {
            name: String::from_str(&env, ""),
            version: String::from_str(&env, "2.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_update_methodology_metadata(&authority, &token_id, &invalid_meta);
        assert_eq!(result, Err(Ok(Error::InvalidName)));
    }

    #[test]
    fn test_validation_whitespace_registry_link() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "   "),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidRegistryLink)));
    }

    #[test]
    fn test_validation_semver_edge_cases() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        // Test empty version (just dots "..")
        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, ".."),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::InvalidVersion)));

        // Test version with letters
        let meta2 = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.2.a"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result2 = client.try_mint_methodology(&authority, &owner, &meta2);
        assert_eq!(result2, Err(Ok(Error::InvalidVersion)));

        // Test version with only one dot
        let meta3 = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.2"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let result3 = client.try_mint_methodology(&authority, &owner, &meta3);
        assert_eq!(result3, Err(Ok(Error::InvalidVersion)));
    }

    #[test]
    fn test_duplicate_identity_rejected_same_authority() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };

        let token_id = client.mint_methodology(&authority, &owner, &meta);
        assert_eq!(token_id, 1);

        // Same (name, version, registry) again — must be rejected even
        // though every field individually passes format validation.
        let result = client.try_mint_methodology(&authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::DuplicateMethodologyIdentity)));
    }

    #[test]
    fn test_duplicate_identity_rejected_regardless_of_authority() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority_a = Address::generate(&env);
        let authority_b = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority_a);
        client.add_authority(&admin, &authority_b);

        let meta_a = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority_a.clone(),
            ipfs_cid: None,
        };

        let token_id = client.mint_methodology(&authority_a, &owner, &meta_a);
        assert_eq!(token_id, 1);

        // A different, also-authorized authority tries to mint the exact
        // same identity as its own token — must still be rejected.
        let meta_b = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://different-host.example.org"),
            issuing_authority: authority_b.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&authority_b, &owner, &meta_b);
        assert_eq!(result, Err(Ok(Error::DuplicateMethodologyIdentity)));
    }

    #[test]
    fn test_same_name_different_version_succeeds() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta_v1 = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let token_id_v1 = client.mint_methodology(&authority, &owner, &meta_v1);
        assert_eq!(token_id_v1, 1);

        // Same name and registry, distinct version ("1.0.0" vs "1.0.1") —
        // a distinct identity, so this must succeed.
        let meta_v2 = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.1"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let token_id_v2 = client.mint_methodology(&authority, &owner, &meta_v2);
        assert_eq!(token_id_v2, 2);
        assert_ne!(token_id_v1, token_id_v2);
    }

    #[test]
    fn test_get_token_by_identity_resolves_known_triple() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let name = String::from_str(&env, "Improved Forest Management");
        let version = String::from_str(&env, "1.0.0");
        let registry = String::from_str(&env, "VERRA");

        let meta = MethodologyMeta {
            name: name.clone(),
            version: version.clone(),
            registry: registry.clone(),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let token_id = client.mint_methodology(&authority, &owner, &meta);

        let resolved = client.get_token_by_identity(&name, &version, &registry);
        assert_eq!(resolved, Some(token_id));

        let unknown = client.get_token_by_identity(
            &name,
            &String::from_str(&env, "9.9.9"),
            &registry,
        );
        assert_eq!(unknown, None);
    }

    #[test]
    fn test_update_identity_collision_rejected() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let meta_a = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let token_a = client.mint_methodology(&authority, &owner, &meta_a);

        let meta_b = MethodologyMeta {
            name: String::from_str(&env, "Avoided Deforestation"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let token_b = client.mint_methodology(&authority, &owner, &meta_b);
        assert_ne!(token_a, token_b);

        // Updating token_b's identity to collide with token_a's must be rejected.
        let colliding_update = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "1.0.0"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org/alt"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let result = client.try_update_methodology_metadata(&authority, &token_b, &colliding_update);
        assert_eq!(result, Err(Ok(Error::DuplicateMethodologyIdentity)));

        // token_b's original identity must remain intact and resolvable.
        assert_eq!(
            client.get_token_by_identity(
                &String::from_str(&env, "Avoided Deforestation"),
                &String::from_str(&env, "1.0.0"),
                &String::from_str(&env, "VERRA"),
            ),
            Some(token_b)
        );
    }

    #[test]
    fn test_update_identity_new_triple_succeeds_and_updates_index() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);
        let owner = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );
        client.add_authority(&admin, &authority);

        let old_name = String::from_str(&env, "Improved Forest Management");
        let old_version = String::from_str(&env, "1.0.0");
        let registry = String::from_str(&env, "VERRA");

        let meta = MethodologyMeta {
            name: old_name.clone(),
            version: old_version.clone(),
            registry: registry.clone(),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        let token_id = client.mint_methodology(&authority, &owner, &meta);
        assert_eq!(
            client.get_token_by_identity(&old_name, &old_version, &registry),
            Some(token_id)
        );

        let new_name = String::from_str(&env, "Improved Forest Management v2");
        let new_version = String::from_str(&env, "2.0.0");
        let updated_meta = MethodologyMeta {
            name: new_name.clone(),
            version: new_version.clone(),
            registry: registry.clone(),
            registry_link: String::from_str(&env, "https://verra.org/updated"),
            issuing_authority: authority.clone(),
            ipfs_cid: None,
        };
        client.update_methodology_metadata(&authority, &token_id, &updated_meta);

        // Old identity no longer resolves; new identity resolves to the same token.
        assert_eq!(
            client.get_token_by_identity(&old_name, &old_version, &registry),
            None
        );
        assert_eq!(
            client.get_token_by_identity(&new_name, &new_version, &registry),
            Some(token_id)
        );
    }

    // ---------------------------------------------------------------------
    // Regression tests: add_authority / remove_authority must never panic on
    // an unset (missing) Authorities storage key; they must treat it as an
    // empty list and return a typed Result instead of trapping the host.
    // ---------------------------------------------------------------------

    #[test]
    fn test_add_remove_authority_on_freshly_initialized_contract() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        // Sanity: no authority has ever been added, so the set is empty and a
        // removal proposal for `authority` must be rejected.
        assert_eq!(
            client.try_propose_remove_authority(&admin, &authority),
            Err(Ok(Error::NotAuthorizedAuthority))
        );

        // Removing from an empty authority set is a no-op, not an error.
        assert_eq!(client.try_remove_authority(&admin, &authority), Ok(Ok(())));

        // Adding the first authority returns cleanly.
        assert_eq!(client.try_add_authority(&admin, &authority), Ok(Ok(())));

        // The authority really landed in the set (a removal proposal is now
        // accepted for it).
        assert!(client
            .try_propose_remove_authority(&admin, &authority)
            .is_ok());

        // Removing it again returns cleanly.
        assert_eq!(client.try_remove_authority(&admin, &authority), Ok(Ok(())));
    }

    #[test]
    fn test_add_remove_authority_with_missing_authorities_key() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let authority = Address::generate(&env);

        let contract_id = env.register(MethodologyLibrary, ());
        let client = MethodologyLibraryClient::new(&env, &contract_id);

        client.initialize(
            &admin,
            &String::from_str(&env, "Carbon methodology"),
            &String::from_str(&env, "CSC-METH"),
            &7u64,
        );

        // Simulate a contract instance whose Authorities key was never written
        // (e.g. an instance deployed/initialized by an older revision).
        env.as_contract(&contract_id, || {
            env.storage().persistent().remove(&DataKey::Authorities);
        });

        // add_authority must not panic: the missing list is treated as empty.
        assert_eq!(client.try_add_authority(&admin, &authority), Ok(Ok(())));

        // The authority was actually appended to the re-created list.
        assert!(client
            .try_propose_remove_authority(&admin, &authority)
            .is_ok());

        // remove_authority must not panic either.
        assert_eq!(client.try_remove_authority(&admin, &authority), Ok(Ok(())));

        // ...and the authority is genuinely gone from the list afterwards.
        assert_eq!(
            client.try_propose_remove_authority(&admin, &authority),
            Err(Ok(Error::NotAuthorizedAuthority))
        );

        // Removing from a completely absent list is a no-op, not an error.
        env.as_contract(&contract_id, || {
            env.storage().persistent().remove(&DataKey::Authorities);
        });
        assert_eq!(client.try_remove_authority(&admin, &authority), Ok(Ok(())));
        assert_eq!(
            client.try_propose_remove_authority(&admin, &authority),
            Err(Ok(Error::NotAuthorizedAuthority))
        );
    }
}
