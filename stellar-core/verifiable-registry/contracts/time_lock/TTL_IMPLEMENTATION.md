# TTL Extension Policy for Lock Record Map

## Overview
This implementation adds a Time-To-Live (TTL) extension policy for the lock record map in the time_lock contract. The policy addresses storage bloat by automatically pruning lock records that have exceeded their retention period after unlock expiration.

## Problem
Lock records remain in persistent storage indefinitely even after credits are released. While `force_release` and `release_if_eligible` functions remove individual records, there is no TTL or expiration policy for stale or orphaned records, leading to unbounded storage growth over time.

## Solution
Added a configurable TTL policy that:
- Stores TTL configuration on-chain
- Provides admin functions to update TTL settings
- Implements permissionless pruning functions
- Emits audit events for all pruned records
- Includes gas-efficient batch operations

## Files Modified
- `stellar-core/verifiable-registry/contracts/time_lock/src/lib.rs`

## Changes Made

### 1. New Error Types
Added two new error variants to `TimeLockError`:
- `InvalidTtlConfig (10)` - Invalid TTL configuration (must be positive)
- `TtlNotConfigured (11)` - TTL not configured or set to 0

### 2. New Data Types
Added `TtlConfig` struct:
```rust
pub struct TtlConfig {
    pub ttl_seconds: u64,      // TTL after unlock expiration (in seconds)
    pub configured_at: u64,     // Timestamp when TTL was configured
}
```

### 3. Storage Key Addition
Added `TtlConfig` to `DataKey` enum for storing TTL configuration in instance storage.

### 4. New Events
Added two new event types for auditability:
- `RecordPruned` - Emitted when a lock record is pruned
- `TtlConfigured` - Emitted when TTL policy is updated

### 5. Updated Initialization
Modified `initialize` function to accept `default_ttl_seconds` parameter:
- Added `default_ttl_seconds: u64` parameter
- Stores initial TTL configuration on initialization
- Setting TTL to 0 disables automatic pruning

### 6. New Query Functions
Added two new query functions:
- `get_record_count()` - Returns the number of lock records in storage
- `get_ttl_config()` - Returns the current TTL configuration

### 7. New Admin Function
Added `set_ttl()` function:
- Admin-only function to update TTL policy
- Emits `TtlConfigured` event
- Stores new TTL configuration with timestamp

### 8. Pruning Functions
Implemented two pruning functions:

#### `prune_expired(token_id)`
- Prunes a single lock record that has exceeded TTL
- Permissionless (allows keepers/relayers to maintain storage)
- Eligibility: `current_time > (unlock_timestamp + ttl_seconds)`
- Emits `RecordPruned` event

#### `batch_prune_expired(token_ids, max_prune)`
- Gas-efficient batch pruning of multiple records
- Skips records not yet eligible or not locked
- Respects `max_prune` limit to control gas costs
- Returns list of successfully pruned token IDs
- Emits `RecordPruned` event for each pruned record

## Configuration

### Default TTL
Set during initialization:
```rust
// 24 hours = 86400 seconds
client.initialize(&admin, &carbon_asset_contract, &false, &None, &86400);

// Disable pruning (TTL = 0)
client.initialize(&admin, &carbon_asset_contract, &false, &None, &0);
```

### Updating TTL
Admin can update TTL at any time:
```rust
client.set_ttl(&admin, &172800); // 48 hours
```

### Querying Configuration
```rust
let ttl_config = client.get_ttl_config();
if let Some(config) = ttl_config {
    println!("TTL: {} seconds", config.ttl_seconds);
}
```

### Monitoring Storage Growth
```rust
let count = client.get_record_count();
println!("Total lock records: {}", count);
```

## Pruning Logic

### Eligibility Calculation
A record is eligible for pruning when:
```
current_timestamp >= (record.unlock_timestamp + ttl_config.ttl_seconds)
```

### Example Timeline
- Lock created at: T = 0
- Unlock timestamp: T = 1000
- TTL: 86400 seconds (24 hours)
- Prune eligible at: T = 87400 (1000 + 86400)

### Permissionless Design
Both pruning functions are permissionless to allow:
- Keepers to automate maintenance
- Relayers to prune for rewards
- Anyone to help reduce storage costs

## Gas Optimization

### Batch Pruning
The `batch_prune_expired` function includes:
- `max_prune` parameter to limit operations per transaction
- Single storage write for all pruned records
- Efficient iteration with early exit

### Recommended Batch Size
- Small batches (10-50 records) for regular maintenance
- Larger batches (100-500) for periodic cleanup
- Adjust based on gas prices and record size

## Audit Trail

### RecordPruned Event
Emitted for each pruned record:
```rust
pub struct RecordPruned {
    pub token_id: u32,
    pub owner: Address,
    pub unlock_timestamp: u64,
    pub deposited_at: u64,
    pub pruned_at: u64,
    pub reason: String,  // Currently "ttl_expired"
}
```

### TtlConfigured Event
Emitted on TTL configuration changes:
```rust
pub struct TtlConfigured {
    pub ttl_seconds: u64,
    pub configured_at: u64,
    pub configured_by: Address,
}
```

## Testing

### Test Coverage
Added tests for:
- `test_initialize_success` - Updated for new parameter
- `test_initialize_twice_returns_already_initialized` - Updated for new parameter
- `test_get_ttl_config` - TTL configuration retrieval
- `test_set_ttl` - TTL configuration update
- `test_get_record_count` - Record count query
- `test_prune_expired_not_configured` - Pruning with TTL disabled
- `test_prune_expired_not_locked` - Pruning non-existent record
- `test_batch_prune_expired_empty_batch` - Batch pruning with empty input
- `test_batch_prune_expired_not_configured` - Batch pruning with TTL disabled

### Running Tests
```bash
cd stellar-core/verifiable-registry/contracts/time_lock
cargo test
```

## Usage Examples

### Basic Pruning
```rust
// Prune a single expired record
match client.try_prune_expired(&token_id) {
    Ok(()) => println!("Record pruned successfully"),
    Err(Ok(TimeLockError::LockNotExpired)) => println!("Not yet eligible"),
    Err(Ok(TimeLockError::TtlNotConfigured)) => println!("TTL not configured"),
    _ => println!("Other error"),
}
```

### Batch Pruning
```rust
// Prune up to 50 expired records
let mut token_ids = vec![&env];
for id in 1..=100 {
    token_ids.push_back(&id);
}

let pruned = client.batch_prune_expired(&token_ids, &50);
println!("Pruned {} records", pruned.len());
```

### Keeper Automation
```rust
// Example keeper logic
fn run_keeper(env: &Env, client: &TimeLockClient) {
    let ttl_config = client.get_ttl_config();
    if ttl_config.is_none() || ttl_config.unwrap().ttl_seconds == 0 {
        return; // Pruning disabled
    }

    let all_records = client.get_all_locked();
    let mut expired_ids = vec![&env];
    
    for record in all_records.iter() {
        let now = env.ledger().timestamp();
        let expiry = record.unlock_timestamp + ttl_config.ttl_seconds;
        if now >= expiry {
            expired_ids.push_back(record.token_id);
        }
    }

    if !expired_ids.is_empty() {
        client.batch_prune_expired(&expired_ids, &100);
    }
}
```

## Migration Notes

### Existing Deployments
For already-deployed contracts:
1. Use `set_ttl()` to configure TTL policy
2. Default TTL is 0 (pruning disabled) until configured
3. Existing records remain until manually pruned or released

### Breaking Changes
- `initialize` function signature changed (new `default_ttl_seconds` parameter)
- Existing deployments need to be redeployed or use migration script

### Recommended TTL Values
- **Development**: 3600 seconds (1 hour)
- **Testing**: 86400 seconds (24 hours)
- **Production**: 2592000 seconds (30 days) or higher

## Benefits
- **Storage Cost Reduction**: Automatic cleanup prevents unbounded growth
- **Configurable**: Admin can adjust retention policy as needed
- **Gas Efficient**: Batch operations minimize transaction costs
- **Audit Trail**: Events provide complete pruning history
- **Permissionless**: Community can help maintain storage
- **Backward Compatible**: TTL=0 allows disabling pruning

## Future Enhancements
- Add automatic pruning on `release_if_eligible` and `force_release`
- Implement priority-based pruning (oldest records first)
- Add prune statistics query (total pruned, last prune time)
- Consider implementing keeper incentives
- Add TTL per vintage year or token type
