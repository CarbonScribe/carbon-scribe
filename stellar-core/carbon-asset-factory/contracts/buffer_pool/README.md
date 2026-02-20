# Buffer Pool Smart Contract

A decentralized insurance pool for CarbonScribe that holds a percentage of issued carbon credits and automatically replaces invalidated credits.

## Overview

The Buffer Pool contract manages custody of carbon credit tokens to provide insurance against invalidation. When carbon credits are minted, a configurable percentage is automatically deposited into the pool. If credits are later invalidated, governance can withdraw replacement credits from the pool.

## Features

- **Automatic Replenishment**: Configurable percentage of minted credits automatically deposited
- **Governance-Controlled Withdrawals**: Only governance can withdraw credits for replacement
- **Transparent Operations**: All state changes emit events for off-chain tracking
- **Custody Tracking**: Complete records of deposited tokens with timestamps and project IDs
- **Query Functions**: View pool statistics and token custody information

## Core Functions

### Initialize

```rust
pub fn initialize(
    env: Env,
    admin: Address,
    governance: Address,
    carbon_asset_contract: Address,
    initial_percentage: i64,
) -> Result<(), Error>
```

One-time setup of the pool. Sets admin, governance, carbon contract, and replenishment rate (in basis points, 0-10000).

### Deposit

```rust
pub fn deposit(
    env: Env,
    caller: Address,
    token_id: u32,
    project_id: String,
) -> Result<(), Error>
```

Manually deposit a credit into the pool. Only callable by admin or carbon_asset_contract.

### Auto-Deposit

```rust
pub fn auto_deposit(
    env: Env,
    carbon_contract_caller: Address,
    token_id: u32,
    project_id: String,
    total_minted: u32,
) -> Result<bool, Error>
```

Called automatically during minting process. Uses modulo calculation to determine if token should be deposited based on replenishment percentage.

Formula: `token_id % (10000 / replenishment_percentage) == 0`

Example: 5% rate (500 basis points) = every 20th token

### Withdraw to Replace

```rust
pub fn withdraw_to_replace(
    env: Env,
    governance_caller: Address,
    token_id: u32,
    target_invalidated_token: u32,
) -> Result<(), Error>
```

Governance withdraws a credit from the pool to replace an invalidated token.

### Configuration Functions

```rust
pub fn set_governance_address(
    env: Env,
    current_governance: Address,
    new_governance: Address,
) -> Result<(), Error>

pub fn set_replenishment_rate(
    env: Env,
    governance: Address,
    new_percentage: i64,
) -> Result<(), Error>
```

### Query Functions

```rust
pub fn get_total_value_locked(env: Env) -> i128
pub fn get_custody_record(env: Env, token_id: u32) -> Option<CustodyRecord>
pub fn is_token_in_pool(env: Env, token_id: u32) -> bool
```

## Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Test

```bash
cargo test
```

## Deploy

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/buffer_pool.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

## Security Considerations

- All admin functions require proper authorization via `require_auth()`
- Percentage values validated to prevent overflow (0-10000 basis points)
- Duplicate deposits prevented
- Only governance can withdraw credits
- Events emitted for all state changes

## Performance

The auto_deposit function is optimized for fast execution (<200ms) using simple modulo arithmetic for allocation decisions.
