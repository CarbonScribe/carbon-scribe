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

#[allow(dead_code)]
pub fn emit_config_update_event(env: &Env, param_name: &Symbol, new_value: i64) {
    #[allow(deprecated)]
    env.events()
        .publish((symbol_short!("config"),), (param_name, new_value));
}
