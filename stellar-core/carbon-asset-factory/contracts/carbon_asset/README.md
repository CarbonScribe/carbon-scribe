# CarbonScribe Carbon Asset
**Dynamic Carbon Credit Token Contract (C-01)**

![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue)
![Rust](https://img.shields.io/badge/Rust-Smart_Contract-orange)
![Contract](https://img.shields.io/badge/Role-Core_Credit_Asset-green)

The Carbon Asset contract is CarbonScribe's primary issuance and lifecycle engine. It mints tokenized carbon credits, enforces transfer and retirement constraints, and exposes a count-based transfer interface aligned to SEP-41 style approval and delegation patterns.

## Key Capabilities

- Credit issuance with immutable per-token metadata
- Role-gated administration, oracle updates, and configuration
- Compliance hook for jurisdiction-aware transfer validation
- Retirement-aware transfer logic and controlled burn flow
- Balance and allowance support for portfolio-style transfers

## Table of Contents

1. [System Role](#system-role)
2. [Contract Architecture](#contract-architecture)
3. [Repository Structure](#repository-structure)
4. [Initialization Parameters](#initialization-parameters)
5. [Public Interface](#public-interface)
6. [Dynamic Credit Readiness](#dynamic-credit-readiness)
7. [Event Sequencing for Off-Chain Indexers](#event-sequencing-for-off-chain-indexers)
8. [Build and Test](#build-and-test)
9. [Testnet Deployment](#testnet-deployment)
10. [Security Notes](#security-notes)

## System Role

This contract anchors the end-to-end lifecycle of a CarbonScribe credit:

1. Admin initializes contract metadata and core dependencies.
2. Admin mints credits to project owners or custodians.
3. Credits transfer through compliant paths to corporate buyers.
4. Retirement tracker and burn flow finalize retirement state on-chain.

## Contract Architecture

```text
+--------------------------+
| Carbon Asset Contract    |
| - token ownership        |
| - metadata and status    |
| - allowance and transfer |
+-----+------------+-------+
      |            |
      |            +----------------------+
      |                                   |
      v                                   v
+--------------------+         +------------------------+
| Retirement Tracker |         | Regulatory Check Hook  |
| burn_token / burn  |         | validate_transaction   |
+--------------------+         +------------------------+
```

## Repository Structure

```text
carbon_asset/
|- src/
|  |- lib.rs             # core contract implementation
|  |- types.rs           # metadata, statuses, and helper types
|  |- storage.rs         # storage keys and mappings
|  |- events.rs          # mint, transfer, status, and score events
|  |- errors.rs          # typed contract errors
|  \- test.rs            # unit tests
|- tests/
|  \- ...                # integration tests
\- Cargo.toml
```

## Initialization Parameters

```rust
initialize(env, admin, name, symbol, retirement_tracker, host_jurisdiction)
```

- `admin`: governance authority for minting and configuration
- `name`: asset display name (example: CarbonScribe Dynamic Credit)
- `symbol`: short tradable symbol (example: CSC-C01)
- `retirement_tracker`: deployed retirement tracker contract address
- `host_jurisdiction`: policy anchor for transfer compliance (example: NG, KE, BR)

Recommended production values:

- Use a multisig-controlled admin address.
- Point `retirement_tracker` to the deployed tracker contract, not a wallet.
- Use a normalized jurisdiction code to align with compliance adapter logic.

## Public Interface

### Issuance

```rust
mint(env, caller, owner, metadata)
```

Mints a credit NFT-like token with metadata including project id, vintage year, methodology id, and geospatial hash.

### Transfers and Allowances

```rust
approve(...)
allowance(...)
transfer(...)
transfer_from(...)
balance(...)
```

Supports count-based transfers and delegated movement of token quantities.

### Retirement and Burn

```rust
burn(...)
burn_from(...)
burn_token(...)
```

Only retirement tracker-authorized flows can execute final burn semantics.

### Compliance and Status

```rust
before_transfer(...)
set_status(...)
set_regulatory_check(...)
set_host_jurisdiction(...)
```

Transfers can call an external compliance contract using:

`validate_transaction(from, to, operation_type, host_jurisdiction)`

### Dynamic Scoring Hooks

```rust
set_oracle(...)
update_quality_score(...)
get_quality_score(...)
```

This path enables telemetry-driven score updates that can support dynamic credit valuation at the application layer.

## Dynamic Credit Readiness

The contract already includes on-chain quality score storage and oracle-authorized updates. To operationalize dynamic pricing end-to-end:

1. Connect satellite and IoT oracle feeds to trusted updater identities.
2. Define score-to-price policy in the marketplace layer.
3. Version and audit oracle update policy via governance controls.

## Event Sequencing for Off-Chain Indexers

All events emitted by the Carbon Asset contract include a `sequence` field that provides replay-safe, monotonic ordering for off-chain indexers. This feature enables:

- **Replay Protection**: Indexers can detect and reject duplicate events by tracking processed sequence numbers
- **Deterministic Ordering**: Events can be ordered consistently across different indexer implementations
- **Idempotent Processing**: Indexers can safely reprocess events without double-counting

### How It Works

The contract maintains an `EventSequence` counter in instance storage that:
- Initializes to 0 on contract deployment
- Increments by 1 for each event emission
- Persists across contract upgrades
- Is included in all event types: `MintEvent`, `TransferEvent`, `StatusChangeEvent`, `QualityScoreUpdatedEvent`, `ApproveEvent`, `Sep41TransferEvent`, and `Sep41BurnEvent`

### Event Structure

All events now include a `sequence: u64` field as the first parameter:

```rust
#[contractevent]
pub struct MintEvent {
    pub sequence: u64,
    pub token_id: u32,
    pub owner: Address,
    pub project_id: String,
    pub vintage_year: u64,
    pub methodology_id: u32,
}
```

### Indexer Integration

Off-chain indexers should:
1. Track the highest processed sequence number per contract instance
2. Reject events with sequence numbers less than or equal to the last processed sequence
3. Use the sequence field to order events when processing out-of-order blocks
4. Store sequence numbers in their database to enable idempotent reprocessing

### Example Indexer Logic

```python
last_sequence = get_last_processed_sequence(contract_address)

for event in events:
    if event.sequence <= last_sequence:
        continue  # Skip already processed event
    
    process_event(event)
    last_sequence = event.sequence
    save_sequence(contract_address, last_sequence)
```

## Build and Test

```bash
cd contracts/carbon_asset
cargo test
cargo build --target wasm32-unknown-unknown --release
```

## Testnet Deployment

```bash
cd contracts/carbon_asset
soroban contract deploy \
  --wasm ../../target/wasm32-unknown-unknown/release/carbon_asset.wasm \
  --source <IDENTITY_NAME> \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

After deploy, invoke `initialize` with real testnet addresses for admin and retirement tracker.

## Security Notes

- One-time initialization lock protects constructor integrity.
- Role checks gate minting, status transitions, and configuration changes.
- Compliance hook enforces jurisdiction-aware transfer policy.
- Burn semantics protect against retirement replay and double-use.
- Rich event emission supports forensic audit and ESG reporting trails.
