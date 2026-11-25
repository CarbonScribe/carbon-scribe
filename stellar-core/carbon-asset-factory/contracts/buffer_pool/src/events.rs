use soroban_sdk::{symbol_short, Address, Env, String, Symbol};

pub fn emit_deposit_event(env: &Env, token_id: u32, depositor: &Address, project_id: &String) {
    #[allow(deprecated)]
    env.events().publish(
        (symbol_short!("deposit"),),
        (token_id, depositor, project_id),
    );
}

pub fn emit_withdraw_event(env: &Env, token_id: u32, target_token_id: u32, governance: &Address) {
    #[allow(deprecated)]
    env.events().publish(
        (symbol_short!("withdraw"),),
        (token_id, target_token_id, governance),
    );
}

pub fn emit_auto_deposit_event(env: &Env, token_id: u32, project_id: &String) {
    #[allow(deprecated)]
    env.events()
        .publish((symbol_short!("auto_dep"),), (token_id, project_id));
}

pub fn emit_duplicate_auto_deposit_event(env: &Env, token_id: u32, project_id: &String) {
    #[allow(deprecated)]
    env.events()
        .publish((symbol_short!("dup_dep"),), (token_id, project_id));
}

pub fn emit_pause_event(env: &Env, paused_by: &Address) {
    #[allow(deprecated)]
    env.events()
        .publish((symbol_short!("pause"),), (paused_by,));
}

pub fn emit_unpause_event(env: &Env, unpaused_by: &Address) {
    #[allow(deprecated)]
    env.events()
        .publish((symbol_short!("unpause"),), (unpaused_by,));
}

#[allow(dead_code)]
pub fn emit_config_update_event(env: &Env, param_name: &Symbol, new_value: i64) {
    #[allow(deprecated)]
    env.events()
        .publish((symbol_short!("config"),), (param_name, new_value));
}

pub fn emit_governance_changed(env: &Env, old: &Address, new: &Address) {
    #[allow(deprecated)]
    env.events().publish(
        (symbol_short!("gov_set"),),
        (old, new, env.ledger().sequence()),
    );
}

pub fn emit_replenishment_rate_changed(
    env: &Env,
    old_bps: i64,
    new_bps: i64,
    changed_by: &Address,
) {
    #[allow(deprecated)]
    env.events().publish(
        (symbol_short!("rate_set"),),
        (old_bps, new_bps, changed_by, env.ledger().sequence()),
    );
}
