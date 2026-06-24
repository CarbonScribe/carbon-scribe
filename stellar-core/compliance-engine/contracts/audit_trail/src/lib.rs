#![no_std]
mod test;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Bytes, BytesN, Env, Map, String, Vec,
};

/// Maximum allowed event payload size in bytes.
pub const MAX_EVENT_PAYLOAD_SIZE: u32 = 1024;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AuditEvent {
    pub event_id: BytesN<32>,
    pub timestamp: u64,
    pub event_type: String,
    pub emitting_contract: Address,
    pub primary_entity_id: String,
    pub secondary_entity_id: Option<String>,
    pub event_data: String,
    pub tx_hash: BytesN<32>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    AuthorizedEmitters,
    Events(BytesN<32>),
    EntityIndex(String),
    TypeTimeIndex((String, u64)),
    ContractIndex(Address),
    RetentionPeriod,
    ActiveDays,
    AllEventsIndex(u64),
    TotalEventCount,
    TotalEventBytes,
}

#[contractevent]
#[derive(Clone, Debug, PartialEq)]
pub struct PruningEvent {
    pub pruned_count: u32,
    pub pruned_bytes: u64,
    pub timestamp: u64,
}

#[contract]
pub struct AuditTrailContract;

#[contractimpl]
impl AuditTrailContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);

        let empty_emitters: Map<Address, bool> = Map::new(&env);
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedEmitters, &empty_emitters);

        env.storage().instance().set(&DataKey::TotalEventCount, &0u32);
        env.storage().instance().set(&DataKey::TotalEventBytes, &0u64);

        let empty_days: Vec<u64> = Vec::new(&env);
        env.storage().instance().set(&DataKey::ActiveDays, &empty_days);

        env.storage().instance().set(&DataKey::RetentionPeriod, &(90u64 * 86400u64));
        Self::extend_instance_ttl(&env);
    }

    pub fn authorize_emitter(env: Env, emitter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut emitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedEmitters)
            .unwrap();
        emitters.set(emitter.clone(), true);
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedEmitters, &emitters);
        Self::extend_instance_ttl(&env);
    }

    pub fn revoke_emitter(env: Env, emitter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut emitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedEmitters)
            .unwrap();
        emitters.set(emitter.clone(), false);
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedEmitters, &emitters);
        Self::extend_instance_ttl(&env);
    }

    pub fn is_authorized(env: Env, emitter: Address) -> bool {
        let emitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedEmitters)
            .unwrap();
        emitters.get(emitter).unwrap_or(false)
    }

    #[allow(unused_variables)]
    pub fn record_event(
        env: Env,
        event_type: String,
        primary_entity_id: String,
        secondary_entity_id: Option<String>,
        event_data: String,
        tx_hash: BytesN<32>,
    ) -> BytesN<32> {
        panic!("Use record_event_auth instead");
    }

    pub fn record_event_auth(
        env: Env,
        emitter: Address,
        event_type: String,
        primary_entity_id: String,
        secondary_entity_id: Option<String>,
        event_data: String,
        tx_hash: BytesN<32>,
    ) -> BytesN<32> {
        emitter.require_auth();

        let emitters: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedEmitters)
            .unwrap();
        if !emitters.get(emitter.clone()).unwrap_or(false) {
            panic!("Emitter not authorized");
        }

        let payload_bytes = event_data.len();
        if payload_bytes > MAX_EVENT_PAYLOAD_SIZE {
            panic!(
                "Event payload exceeds maximum allowed size of {} bytes",
                MAX_EVENT_PAYLOAD_SIZE
            );
        }

        let timestamp = env.ledger().timestamp();

        let mut hash_payload = Bytes::new(&env);
        hash_payload.append(&Bytes::from_slice(&env, &tx_hash.to_array()));
        hash_payload.append(&Bytes::from_slice(&env, &timestamp.to_be_bytes()));

        let event_id: BytesN<32> = env.crypto().sha256(&hash_payload).into();

        let event_size = 32 + 8 
            + event_type.len() as u64 
            + 32 
            + primary_entity_id.len() as u64 
            + secondary_entity_id.as_ref().map(|s| s.len() as u64).unwrap_or(0) 
            + event_data.len() as u64 
            + 32;

        let event = AuditEvent {
            event_id: event_id.clone(),
            timestamp,
            event_type: event_type.clone(),
            emitting_contract: emitter.clone(),
            primary_entity_id: primary_entity_id.clone(),
            secondary_entity_id: secondary_entity_id.clone(),
            event_data,
            tx_hash,
        };

        let event_key = DataKey::Events(event_id.clone());
        env.storage()
            .persistent()
            .set(&event_key, &event);
        
        Self::extend_key_ttl(&env, &event_key, timestamp);

        let entity_key = DataKey::EntityIndex(primary_entity_id.clone());
        let mut entity_events: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&entity_key)
            .unwrap_or_else(|| Vec::new(&env));
        entity_events.push_back(event_id.clone());
        env.storage().persistent().set(&entity_key, &entity_events);
        Self::extend_key_ttl(&env, &entity_key, timestamp);

        let day_timestamp = timestamp / 86400 * 86400;
        let type_time_key = DataKey::TypeTimeIndex((event_type.clone(), day_timestamp));
        let mut type_time_events: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&type_time_key)
            .unwrap_or_else(|| Vec::new(&env));
        type_time_events.push_back(event_id.clone());
        env.storage()
            .persistent()
            .set(&type_time_key, &type_time_events);
        Self::extend_key_ttl(&env, &type_time_key, timestamp);

        let contract_key = DataKey::ContractIndex(emitter.clone());
        let mut contract_events: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&contract_key)
            .unwrap_or_else(|| Vec::new(&env));
        contract_events.push_back(event_id.clone());
        env.storage()
            .persistent()
            .set(&contract_key, &contract_events);
        Self::extend_key_ttl(&env, &contract_key, timestamp);

        let active_days: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveDays)
            .unwrap_or_else(|| Vec::new(&env));
        
        let mut has_day = false;
        for d in active_days.iter() {
            if d == day_timestamp {
                has_day = true;
                break;
            }
        }
        if !has_day {
            let mut active_days_mut = active_days.clone();
            active_days_mut.push_back(day_timestamp);
            env.storage().instance().set(&DataKey::ActiveDays, &active_days_mut);
        }

        let day_events_key = DataKey::AllEventsIndex(day_timestamp);
        let mut day_events: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&day_events_key)
            .unwrap_or_else(|| Vec::new(&env));
        day_events.push_back(event_id.clone());
        env.storage().persistent().set(&day_events_key, &day_events);
        Self::extend_key_ttl(&env, &day_events_key, timestamp);

        let total_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalEventCount)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalEventCount, &(total_count + 1));

        let total_bytes: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalEventBytes)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalEventBytes, &(total_bytes + event_size));

        Self::extend_instance_ttl(&env);

        event_id
    }

    pub fn get_event(env: Env, event_id: BytesN<32>) -> Option<AuditEvent> {
        let key = DataKey::Events(event_id.clone());
        if let Some(event) = env
            .storage()
            .persistent()
            .get::<DataKey, AuditEvent>(&key)
        {
            Self::extend_key_ttl(&env, &key, event.timestamp);
            Some(event)
        } else {
            None
        }
    }

    pub fn get_events_by_entity(env: Env, entity_id: String) -> Vec<AuditEvent> {
        let entity_key = DataKey::EntityIndex(entity_id);
        let event_ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&entity_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut events = Vec::new(&env);
        for id in event_ids.iter() {
            if let Some(e) = env
                .storage()
                .persistent()
                .get::<DataKey, AuditEvent>(&DataKey::Events(id.clone()))
            {
                Self::extend_key_ttl(&env, &DataKey::Events(id.clone()), e.timestamp);
                Self::extend_key_ttl(&env, &entity_key, e.timestamp);
                events.push_back(e);
            }
        }
        events
    }

    pub fn get_events_by_entity_paged(
        env: Env,
        entity_id: String,
        start: u32,
        limit: u32,
    ) -> Vec<AuditEvent> {
        let entity_key = DataKey::EntityIndex(entity_id);
        let event_ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&entity_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut events = Vec::new(&env);

        let total = event_ids.len();
        if start >= total {
            return events;
        }

        let end = core::cmp::min(start + limit, total);

        for i in start..end {
            let id = event_ids.get(i).unwrap();
            if let Some(e) = env
                .storage()
                .persistent()
                .get::<DataKey, AuditEvent>(&DataKey::Events(id.clone()))
            {
                Self::extend_key_ttl(&env, &DataKey::Events(id.clone()), e.timestamp);
                Self::extend_key_ttl(&env, &entity_key, e.timestamp);
                events.push_back(e);
            }
        }
        events
    }

    pub fn get_events_by_type_and_time(
        env: Env,
        event_type: String,
        timestamp: u64,
    ) -> Vec<AuditEvent> {
        let day_timestamp = timestamp / 86400 * 86400;
        let type_time_key = DataKey::TypeTimeIndex((event_type, day_timestamp));
        let event_ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&type_time_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut events = Vec::new(&env);
        for id in event_ids.iter() {
            if let Some(e) = env
                .storage()
                .persistent()
                .get::<DataKey, AuditEvent>(&DataKey::Events(id.clone()))
            {
                Self::extend_key_ttl(&env, &DataKey::Events(id.clone()), e.timestamp);
                Self::extend_key_ttl(&env, &type_time_key, e.timestamp);
                events.push_back(e);
            }
        }
        events
    }

    pub fn get_events_by_contract(env: Env, emitter: Address) -> Vec<AuditEvent> {
        let contract_key = DataKey::ContractIndex(emitter);
        let event_ids: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&contract_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut events = Vec::new(&env);
        for id in event_ids.iter() {
            if let Some(e) = env
                .storage()
                .persistent()
                .get::<DataKey, AuditEvent>(&DataKey::Events(id.clone()))
            {
                Self::extend_key_ttl(&env, &DataKey::Events(id.clone()), e.timestamp);
                Self::extend_key_ttl(&env, &contract_key, e.timestamp);
                events.push_back(e);
            }
        }
        events
    }

    pub fn set_retention_period(env: Env, period_secs: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::RetentionPeriod, &period_secs);
        Self::extend_instance_ttl(&env);
    }

    pub fn get_retention_period(env: Env) -> u64 {
        Self::get_retention_period_internal(&env)
    }

    pub fn prune_old_events(env: Env) -> u32 {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let retention_period = Self::get_retention_period_internal(&env);
        let current_time = env.ledger().timestamp();

        let active_days: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::ActiveDays)
            .unwrap_or_else(|| Vec::new(&env));

        let mut new_active_days = Vec::new(&env);
        let mut pruned_count: u32 = 0;
        let mut pruned_bytes: u64 = 0;

        for day in active_days.iter() {
            if day + retention_period < current_time {
                let day_events_key = DataKey::AllEventsIndex(day);
                if let Some(event_ids) = env
                    .storage()
                    .persistent()
                    .get::<DataKey, Vec<BytesN<32>>>(&day_events_key)
                {
                    for event_id in event_ids.iter() {
                        if let Some(event) = env
                            .storage()
                            .persistent()
                            .get::<DataKey, AuditEvent>(&DataKey::Events(event_id.clone()))
                        {
                            let entity_key = DataKey::EntityIndex(event.primary_entity_id.clone());
                            if let Some(mut entity_events) = env
                                .storage()
                                .persistent()
                                .get::<DataKey, Vec<BytesN<32>>>(&entity_key)
                            {
                                if let Some(idx) = entity_events.first_index_of(&event_id) {
                                    entity_events.remove(idx);
                                    if entity_events.is_empty() {
                                        env.storage().persistent().remove(&entity_key);
                                    } else {
                                        env.storage().persistent().set(&entity_key, &entity_events);
                                    }
                                }
                            }

                            let type_time_key = DataKey::TypeTimeIndex((event.event_type.clone(), day));
                            if let Some(mut type_time_events) = env
                                .storage()
                                .persistent()
                                .get::<DataKey, Vec<BytesN<32>>>(&type_time_key)
                            {
                                if let Some(idx) = type_time_events.first_index_of(&event_id) {
                                    type_time_events.remove(idx);
                                    if type_time_events.is_empty() {
                                        env.storage().persistent().remove(&type_time_key);
                                    } else {
                                        env.storage().persistent().set(&type_time_key, &type_time_events);
                                    }
                                }
                            }

                            let contract_key = DataKey::ContractIndex(event.emitting_contract.clone());
                            if let Some(mut contract_events) = env
                                .storage()
                                .persistent()
                                .get::<DataKey, Vec<BytesN<32>>>(&contract_key)
                            {
                                if let Some(idx) = contract_events.first_index_of(&event_id) {
                                    contract_events.remove(idx);
                                    if contract_events.is_empty() {
                                        env.storage().persistent().remove(&contract_key);
                                    } else {
                                        env.storage().persistent().set(&contract_key, &contract_events);
                                    }
                                }
                            }

                            let event_size = 32 + 8 
                                + event.event_type.len() as u64 
                                + 32 
                                + event.primary_entity_id.len() as u64 
                                + event.secondary_entity_id.as_ref().map(|s| s.len() as u64).unwrap_or(0) 
                                + event.event_data.len() as u64 
                                + 32;

                            pruned_bytes += event_size;
                            pruned_count += 1;

                            env.storage().persistent().remove(&DataKey::Events(event_id));
                        }
                    }
                    env.storage().persistent().remove(&day_events_key);
                }
            } else {
                new_active_days.push_back(day);
            }
        }

        env.storage().instance().set(&DataKey::ActiveDays, &new_active_days);

        if pruned_count > 0 {
            let total_count: u32 = env
                .storage()
                .instance()
                .get(&DataKey::TotalEventCount)
                .unwrap_or(0);
            let new_total_count = total_count.saturating_sub(pruned_count);
            env.storage().instance().set(&DataKey::TotalEventCount, &new_total_count);

            let total_bytes: u64 = env
                .storage()
                .instance()
                .get(&DataKey::TotalEventBytes)
                .unwrap_or(0);
            let new_total_bytes = total_bytes.saturating_sub(pruned_bytes);
            env.storage().instance().set(&DataKey::TotalEventBytes, &new_total_bytes);

            PruningEvent {
                pruned_count,
                pruned_bytes,
                timestamp: current_time,
            }
            .publish(&env);
        }

        Self::extend_instance_ttl(&env);

        pruned_count
    }

    pub fn get_event_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalEventCount)
            .unwrap_or(0)
    }

    pub fn get_total_storage_bytes(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalEventBytes)
            .unwrap_or(0)
    }

    fn get_retention_period_internal(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::RetentionPeriod)
            .unwrap_or(90 * 86400)
    }

    fn extend_key_ttl(env: &Env, key: &DataKey, timestamp: u64) {
        let retention_period = Self::get_retention_period_internal(env);
        let current_time = env.ledger().timestamp();
        if timestamp + retention_period >= current_time {
            let remaining_seconds = (timestamp + retention_period) - current_time;
            // Convert to ledgers (assume 5s per ledger, round up)
            let mut remaining_ledgers = ((remaining_seconds + 4) / 5) as u32;
            let max_ttl = env.storage().max_ttl();
            if remaining_ledgers > max_ttl {
                remaining_ledgers = max_ttl;
            }
            let threshold = remaining_ledgers.saturating_sub(17280); // 1 day before limit
            env.storage()
                .persistent()
                .extend_ttl(key, threshold, remaining_ledgers);
        }
    }

    fn extend_instance_ttl(env: &Env) {
        // Extend instance storage TTL to at least 30 days (518,400 ledgers)
        // threshold is 29 days (501,120 ledgers)
        env.storage()
            .instance()
            .extend_ttl(501120, 518400);
    }
}
