# CarbonScribe Methodology Library
**On-Chain Methodology Credential Registry**

![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue)
![Rust](https://img.shields.io/badge/Rust-Smart_Contract-orange)
![Contract](https://img.shields.io/badge/Role-Methodology_Provenance-green)

The Methodology Library contract tokenizes carbon accounting methodologies as transferable on-chain records. It provides auditable methodology provenance, authority management, and verification checks used by the broader CarbonScribe issuance stack.

## Key Capabilities

- Methodology minting by whitelisted issuing authorities
- Structured methodology metadata storage
- Authority add/remove lifecycle under admin governance
- Ownership and approval model for methodology tokens
- On-chain validity checks against current trusted authority set

## Table of Contents

1. [System Role](#system-role)
2. [Contract Architecture](#contract-architecture)
3. [Repository Structure](#repository-structure)
4. [Initialization Parameters](#initialization-parameters)
5. [Public Interface](#public-interface)
6. [Operational Flow](#operational-flow)
7. [Build and Test](#build-and-test)
8. [Testnet Deployment](#testnet-deployment)
9. [Security Notes](#security-notes)

## System Role

This contract acts as CarbonScribe's methodology trust layer:

1. Admin initializes library metadata and authority list.
2. Approved standards bodies mint methodology records.
3. Carbon issuance workflows reference methodology token ids.
4. Validity checks confirm methodology authority remains trusted.

## Contract Architecture

```text
+---------------------------+
| Methodology Library       |
| - methodology metadata    |
| - ownership and approvals |
| - authority governance    |
+------------+--------------+
             |
             v
+---------------------------+
| Carbon Asset Issuance     |
| methodology_id reference  |
+---------------------------+
```

## Repository Structure

```text
methodology_library/
|- src/
|  \- lib.rs              # contract, metadata types, authority controls, tests
|- test_snapshots/
|  \- ...                 # captured test snapshots
\- Cargo.toml
```

## Initialization Parameters

```rust
initialize(env, admin, name, symbol)
```

- `admin`: governance address for authority and admin management (must sign the transaction via require_auth)
- `name`: methodology collection display name
- `symbol`: short symbol for methodology token class

Security Note

The initialize function is restricted to the admin account only. The admin must authenticate the call using require_auth(). Any unauthorized attempt to initialize the contract will fail and no state will be written.
## Public Interface

### Authority and Governance

```rust
add_authority(env, admin_caller, authority)
remove_authority(env, admin_caller, authority)
transfer_admin(env, admin_caller, new_admin)
get_admin(env)
```

### Methodology Issuance

```rust
mint_methodology(env, caller, owner, meta)
```

The `meta` payload includes:

- methodology name and version
- external registry and link
- issuing authority
- optional IPFS content id

### Token Ownership and Validation

```rust
owner_of(env, token_id)
approve(env, caller, to, token_id)
transfer_from(env, caller, from, to, token_id)
get_methodology_meta(env, token_id)
is_valid_methodology(env, token_id)
```

`is_valid_methodology` returns true only when the methodology exists and its issuing authority remains in the active trusted set.

## Operational Flow

```text
Admin setup -> authority onboarding -> methodology mint -> issuance reference -> ongoing validity checks
```

## Build and Test

```bash
cd contracts/methodology_library
cargo test
cargo build --target wasm32-unknown-unknown --release
```

## Testnet Deployment

```bash
cd contracts/methodology_library
soroban contract deploy \
  --wasm ../../target/wasm32-unknown-unknown/release/methodology_library.wasm \
  --source <IDENTITY_NAME> \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

## Security Notes

- Only whitelisted authorities can mint methodologies.
- Metadata issuing authority must match authenticated caller.
- Admin-only authority list mutation prevents unauthorized trust escalation.
- Transfer and approval rules follow explicit owner and delegate checks.
