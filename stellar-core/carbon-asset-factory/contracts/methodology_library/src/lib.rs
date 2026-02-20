#![no_std]
#![allow(deprecated)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
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
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    NextTokenId,
    Authorities,
    Methodology(u32),
    Owner(u32),
    Approved(u32),
}

#[contract]
pub struct MethodologyLibrary;

#[contractimpl]
impl MethodologyLibrary {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::Name, &name);
        env.storage().persistent().set(&DataKey::Symbol, &symbol);
        env.storage().persistent().set(&DataKey::NextTokenId, &1u32);
        env.storage().persistent().set(&DataKey::Authorities, &Vec::<Address>::new(&env));
        Ok(())
    }

    pub fn mint_methodology(env: Env, caller: Address, owner: Address, meta: MethodologyMeta) -> Result<u32, Error> {
        caller.require_auth();

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

        let token_id: u32 = env.storage().persistent().get(&DataKey::NextTokenId).ok_or(Error::NotInitialized)?;
        
        env.storage().persistent().set(&DataKey::Methodology(token_id), &meta);
        env.storage().persistent().set(&DataKey::Owner(token_id), &owner);
        env.storage().persistent().set(&DataKey::NextTokenId, &(token_id + 1));

        env.events().publish(
            (symbol_short!("mint"), token_id),
            (caller, owner, meta.name)
        );

        Ok(token_id)
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

        let mut authorities: Vec<Address> = env.storage().persistent().get(&DataKey::Authorities).unwrap();
        if !authorities.contains(&authority) {
            authorities.push_back(authority.clone());
            env.storage().persistent().set(&DataKey::Authorities, &authorities);
            env.events().publish((symbol_short!("auth_add"),), authority);
        }
        Ok(())
    }

    pub fn remove_authority(env: Env, admin_caller: Address, authority: Address) -> Result<(), Error> {
        admin_caller.require_auth();
        let admin: Address = env.storage().persistent().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin_caller != admin {
            return Err(Error::Unauthorized);
        }

        let authorities: Vec<Address> = env.storage().persistent().get(&DataKey::Authorities).unwrap();
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
    use soroban_sdk::testutils::Address as _;
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
        );

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "VM0042 v2.1"),
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
        );

        let meta = MethodologyMeta {
            name: String::from_str(&env, "Improved Forest Management"),
            version: String::from_str(&env, "VM0042 v2.1"),
            registry: String::from_str(&env, "VERRA"),
            registry_link: String::from_str(&env, "https://verra.org"),
            issuing_authority: non_authority.clone(),
            ipfs_cid: None,
        };

        let result = client.try_mint_methodology(&non_authority, &owner, &meta);
        assert_eq!(result, Err(Ok(Error::NotAuthorizedAuthority)));
    }
}
