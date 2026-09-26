use soroban_sdk::{contractevent, Address, Env};

#[contractevent]
pub struct Initialized {
    pub admin: Address,
    pub timestamp: u64,
}

#[contractevent]
pub struct ReinitializationAttempted {
    pub attempted_by: Address,
    pub timestamp: u64,
}

pub fn emit_initialized_event(env: &Env, admin: Address) {
    Initialized {
        admin,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}

pub fn emit_reinitialization_attempted_event(env: &Env, attempted_by: Address) {
    ReinitializationAttempted {
        attempted_by,
        timestamp: env.ledger().timestamp(),
    }
    .publish(env);
}
