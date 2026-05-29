# CarbonScribe Retirement Tracker
**Immutable On-Chain Carbon Retirement Ledger**

![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue)
![Rust](https://img.shields.io/badge/Rust-Smart_Contract-orange)
![Contract](https://img.shields.io/badge/Role-Retirement_Proof-green)

The Retirement Tracker contract is CarbonScribe's finality layer for carbon offset usage. It retires credits by invoking burn logic on the carbon asset contract, then writes immutable retirement records for compliance, audit, and public proof.

## Key Capabilities

- Single and batch retirement flows
- Immutable retirement records per token id
- Entity-based retirement indexing for reporting
- Linked contract governance for upgradeable asset references
- Event emission with contract-scoped nonces for real-time compliance pipelines

## Table of Contents

1. [System Role](#system-role)
2. [Contract Architecture](#contract-architecture)
3. [Repository Structure](#repository-structure)
4. [Initialization Parameters](#initialization-parameters)
5. [Public Interface](#public-interface)
6. [Retirement Record Model](#retirement-record-model)
7. [Build and Test](#build-and-test)
8. [Testnet Deployment](#testnet-deployment)
9. [Security Notes](#security-notes)

## System Role

This contract finalizes offset lifecycle state:

1. Corporate or retiring entity authorizes retirement request.
2. Contract verifies token is not already retired.
3. Contract invokes carbon asset burn pathway.
4. Immutable retirement record is stored and indexed.
5. Event stream powers certificates, reporting, and transparency dashboards.

## Contract Architecture

```text
+---------------------------+
| Retiring Entity           |
+------------+--------------+
             |
             v
+---------------------------+
| Retirement Tracker        |
| - retire / batch_retire   |
| - retirement ledger       |
| - entity index            |
+------------+--------------+
             |
             v
+---------------------------+
| Carbon Asset Contract     |
| burn_token(token_id, from)|
+---------------------------+
```

## Repository Structure

```text
retirement_tracker/
|- src/
|  \- lib.rs              # retirement logic, records, events, admin controls
|- tests/
|  \- ...                 # test scenarios
\- Cargo.toml
```

## Initialization Parameters

```rust
initialize(env, admin, carbon_asset_contract)
```

- `admin`: authority for linked contract updates
- `carbon_asset_contract`: active carbon asset contract used for burn calls

## Public Interface

### Retirement Execution

```rust
retire(env, token_id, retiring_entity, reason)
retire_with_tx_hash(env, token_id, retiring_entity, reason, tx_hash)
batch_retire(env, token_ids, retiring_entity, reason)
batch_retire_with_tx_hashes(env, token_ids, retiring_entity, reason, tx_hashes)
```

- `retire`: executes one retirement with nonce fallback and returns the created record
- `retire_with_tx_hash`: executes one retirement with a caller-supplied actual transaction hash
- `batch_retire`: attempts each token with nonce fallback and returns only successful retirements
- `batch_retire_with_tx_hashes`: attempts each token with caller-supplied transaction hashes

### Ledger Queries

```rust
is_retired(env, token_id)
get_retirement_record(env, token_id)
get_retirements_by_entity(env, retiring_entity)
get_event_nonce(env)
```

### Admin Controls

```rust
update_carbon_asset_contract(env, caller, new_contract)
get_admin(env)
get_carbon_asset_contract(env)
```

## Retirement Record Model

Each `RetirementRecord` stores:

- token id
- retiring entity address
- ledger timestamp
- actual transaction hash when supplied
- contract-scoped event nonce
- optional reason string for reporting context

This schema supports corporate disclosures, anti-double-counting checks, and public retirement proof.

## Event Uniqueness

The contract does not synthesize transaction hashes. When an integration has the actual transaction hash, it should call `retire_with_tx_hash` or `batch_retire_with_tx_hashes`. Otherwise, the contract records `tx_hash: None` and assigns a strictly increasing `event_nonce`.

`event_nonce` is stored in instance storage, increments only for successful retirement writes, and is included in both retirement records and retirement events. Off-chain indexers can use it for deterministic ordering and replay-safe uniqueness.

## Build and Test

```bash
cd contracts/retirement_tracker
cargo test
cargo build --target wasm32-unknown-unknown --release
```

## Testnet Deployment

```bash
cd contracts/retirement_tracker
soroban contract deploy \
  --wasm ../../target/wasm32-unknown-unknown/release/retirement_tracker.wasm \
  --source <IDENTITY_NAME> \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

Then call `initialize` with the deployed carbon asset contract address before retirement operations.

## Security Notes

- Retiring entity authentication is mandatory for retirement calls.
- Duplicate retirement is blocked by immutable ledger key checks.
- Admin-only linked contract updates reduce unauthorized redirection risk.
- Burn invocation plus retirement record write keeps retirement flow auditable.
