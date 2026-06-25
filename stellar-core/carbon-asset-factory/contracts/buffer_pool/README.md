# CarbonScribe Buffer Pool

**Carbon Credit Risk Mitigation Reserve**

![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue)
![Rust](https://img.shields.io/badge/Rust-Smart_Contract-orange)
![Contract](https://img.shields.io/badge/Role-Insurance_Reserve-green)

The Buffer Pool contract is CarbonScribe's on-chain insurance reserve. It accumulates a configurable percentage of issued credits and gives governance a controlled mechanism to replace invalidated credits without breaking retirement integrity.

## Key Capabilities

- Automatic reserve replenishment in basis points
- Manual custody deposit support for admin and core asset contract
- Governance-only replacement withdrawals backed by atomic cross-contract asset transfers
- Per-token custody records with timestamp and project lineage
- Public TVL and custody query endpoints

## Table of Contents

- [System Role](#system-role)
- [Contract Architecture](#contract-architecture)
- [Repository Structure](#repository-structure)
- [Public Interface](#public-interface)
- [Operational Flow](#operational-flow)
- [Build and Test](#build-and-test)
- [Testnet Deployment](#testnet-deployment)
- [Security Notes](#security-notes)

---

## System Role

Within CarbonScribe's settlement layer, this contract acts as a protocol-level shock absorber:

1. Credits are minted in the primary carbon asset contract.
2. A configured reserve fraction is routed into this pool.
3. If credits are later invalidated, governance invokes a withdrawal command.
4. The contract initiates a cross-contract transfer-out to move the real token asset and deletes the custody entry only on transfer success.

Corporate retirement trust remains protected by transactional atomicity and on-chain traceability.

---

## Contract Architecture

```text
+--------------------------+
| Carbon Asset Contract    |
| (mint and auto_deposit)  |
+------------+-------------+
             ^
             | (1. invoke cross-contract transfer)
             |
+------------+-------------+
| Buffer Pool Contract     |
| - custody records        | <--- (2. Deletes record on transfer success)
| - replenishment rate     |
| - total value locked     |
+------------+-------------+
             ^
             | (0. calls withdraw_to_replace)
             |
+------------+-------------+
| Governance Withdrawal    |
| withdraw_to_replace(...) |
+--------------------------+
```

---

## Repository Structure

```text
buffer_pool/
├─ src/
│  ├─ lib.rs              # contract logic and public entrypoints
│  ├─ storage.rs          # custody, tvl, and config keys
│  ├─ events.rs           # deposit, transfer-out, and withdrawal events
│  ├─ errors.rs           # typed contract errors
│  └─ test.rs             # unit tests
├─ tests/
│  └─ integration_test.rs # integration scenarios
└─ Cargo.toml
```

---

## Public Interface

### Initialization

```rust
initialize(
    env,
    admin,
    governance,
    carbon_asset_contract,
    initial_percentage
)
```

One-time setup with:

- **admin**: emergency and configuration authority
- **governance**: replacement withdrawal authority
- **carbon_asset_contract**: trusted auto-deposit caller and cross-contract asset invocation target
- **initial_percentage**: reserve rate in basis points, must be `0..=10000`

### Deposits

```rust
deposit(env, caller, token_id, project_id)

auto_deposit(
    env,
    carbon_contract_caller,
    token_id,
    project_id,
    total_minted
)
```

#### `deposit`

Manual custody intake, restricted to admin or linked carbon contract.

#### `auto_deposit`

Deterministic reserve intake. Returns `true` when deposited.

Selection formula:

```rust
token_id % (10000 / percentage) == 0
```

At **500 bps (5%)**, approximately every **20th token** is reserved.

### Replacement Withdrawal

```rust
withdraw_to_replace(
    env,
    governance_caller,
    token_id,
    target_invalidated_token
)
```

Governance signals a token removal. The contract invokes a cross-contract token transfer moving **1 token unit** from this pool to the `governance_caller`.

If the asset contract call returns successfully, the internal persistent custody record is safely deleted.

### Governance and Queries

```rust
set_governance_address(
    env,
    current_governance,
    new_governance
)

set_replenishment_rate(
    env,
    governance,
    new_percentage
)

get_total_value_locked(env)

get_custody_record(env, token_id)

is_token_in_pool(env, token_id)
```

---

## Operational Flow

```text
Mint
  -> auto_deposit decision
  -> custody write
  -> TVL increment

Invalidation event
  -> governance withdrawal
  -> cross-contract transfer-out
  -> custody deletion
  -> TVL decrement
  -> replacement trace
```

---

## Build and Test

```bash
cd contracts/buffer_pool

cargo test

cargo build \
  --target wasm32-unknown-unknown \
  --release
```

---

## Testnet Deployment

```bash
cd contracts/buffer_pool

soroban contract deploy \
  --wasm ../../target/wasm32-unknown-unknown/release/buffer_pool.wasm \
  --source <IDENTITY_NAME> \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

---

## Security Notes

### Transactional Atomicity Enforced

Custody record deletions and value locks are linked directly to successful execution of the external token contract. A failure in the token layer leaves the pool state entirely untouched.

### Role-Based Authorization

Authorization checks enforce role boundaries for all privileged actions.

### Safe Reserve Configuration

Reserve rate is bounded to avoid invalid arithmetic and policy abuse.

### Duplicate Protection

Duplicate custody entries are rejected.

### Governance-Controlled Withdrawals

Withdrawals are limited exclusively to governance.

### Auditable Event Trail

Event emission supports audited off-chain monitoring, tracking both internal state transitions and cross-contract lifecycle sequences.
