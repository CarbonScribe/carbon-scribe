# Global Offline and Degraded-Network Indicator Implementation

## Overview
This implementation adds a global connectivity monitoring system to the CarbonScribe corporate platform web application. The system provides real-time feedback on network status, queues mutation requests during offline periods, and displays connectivity state to users to prevent confusion during network instability.

## Files Created/Modified

### New Files
1. **src/contexts/ConnectivityContext.tsx** - Connectivity state management context and hook
2. **src/lib/utils/requestQueue.ts** - Request queue manager for offline writes
3. **src/components/layout/ConnectionStatus.tsx** - Connection status indicator component
4. **src/contexts/ConnectivityContext.test.ts** - Tests for connectivity context

### Modified Files
1. **.env.example** - Added connectivity monitoring configuration
2. **src/components/layout/PlatformShell.tsx** - Integrated ConnectivityProvider
3. **src/services/api-client.ts** - Integrated request queue for offline writes
4. **src/lib/utils/errorParser.ts** - Added retryable error detection functions

## Configuration

### Environment Variables
Add these to your `.env` file:

```bash
# Connectivity Monitoring Configuration
NEXT_PUBLIC_DEGRADED_THRESHOLD=3
NEXT_PUBLIC_DEGRADED_RECOVERY_THRESHOLD=2
NEXT_PUBLIC_CONNECTIVITY_CHECK_INTERVAL=30000
NEXT_PUBLIC_MAX_QUEUE_SIZE=100
NEXT_PUBLIC_QUEUE_MAX_RETRIES=3
```

### Configuration Parameters
- **DEGRADED_THRESHOLD** (default: 3) - Number of consecutive failures to trigger degraded state
- **DEGRADED_RECOVERY_THRESHOLD** (default: 2) - Number of consecutive successes to recover from degraded
- **CONNECTIVITY_CHECK_INTERVAL** (default: 30000) - Connectivity check interval in milliseconds
- **MAX_QUEUE_SIZE** (default: 100) - Maximum number of queued offline requests
- **QUEUE_MAX_RETRIES** (default: 3) - Maximum retry attempts for queued requests

## Connectivity States

### Online (Green)
- Network connection available
- API calls succeeding
- No pending operations
- Indicator: Green with "Connected" text

### Degraded (Yellow)
- Network connection available but unstable
- Consecutive API failures detected
- Data may be stale
- Indicator: Yellow with "Limited Connectivity" text

### Offline (Red)
- No network connection
- Mutation requests are queued
- Indicator: Red with "Offline" text
- Pending operations counter shown

## Usage

### Using the Connectivity Context

```typescript
import { useConnectivity } from '@/contexts/ConnectivityContext';

function MyComponent() {
  const { state, recordApiCall, incrementPendingOperations } = useConnectivity();

  // Record API call success/failure
  const fetchData = async () => {
    try {
      await apiCall();
      recordApiCall(true);
    } catch (error) {
      recordApiCall(false);
    }
  };

  // Track pending operations
  const submitData = async () => {
    incrementPendingOperations();
    try {
      await apiCall();
    } finally {
      // decrementPendingOperations(); // Called automatically on success
    }
  };

  return (
    <div>
      <p>Status: {state.status}</p>
      <p>Pending: {state.pendingOperations}</p>
    </div>
  );
}
```

### Using the Connection Status Indicator

```tsx
import ConnectionStatus from '@/components/layout/ConnectionStatus';

// Full indicator with details panel
<ConnectionStatus />

// Compact version for tight spaces
import { CompactConnectionStatus } from '@/components/layout/ConnectionStatus';
<CompactConnectionStatus />
```

### Queueing Offline Requests

```typescript
import { apiClient } from '@/services/api-client';

// Queue request when offline
const response = await apiClient.post('/create', data, {
  queueOffline: true, // Enable offline queuing for mutation requests
});

if (!response.success && response.statusCode === 0) {
  // Request was queued due to offline state
  console.log('Request queued for later');
}
```

### Manually Retrying Pending Operations

```typescript
import { useConnectivity } from '@/contexts/ConnectivityContext';

function MyComponent() {
  const { retryPendingOperations } = useConnectivity();

  const handleRetry = async () => {
    const { success, failed } = await retryPendingOperations();
    console.log(`Retried: ${success} succeeded, ${failed} failed`);
  };

  return <button onClick={handleRetry}>Retry Pending</button>;
}
```

## Request Queue Features

### Automatic Queuing
- Mutation requests (POST, PUT, PATCH, DELETE) are automatically queued when offline if `queueOffline: true`
- Requests are stored in localStorage for persistence across page refreshes
- Maximum queue size prevents memory issues

### Automatic Retry
- Queued requests are automatically retried when connection is restored
- Failed requests are retried up to the configured maximum
- Requests that exceed max retries are removed from the queue

### Queue State
```typescript
import { requestQueue } from '@/lib/utils/requestQueue';

const state = requestQueue.getState();
console.log(state.totalQueued);    // Total requests in queue
console.log(state.totalProcessed);  // Requests that have been retried
console.log(state.totalFailed);     // Requests that failed after max retries
```

## Integration with API Clients

### ApiClient Integration
The `ApiClient` in `src/services/api-client.ts` now supports offline queuing:

```typescript
// Enable offline queuring for mutation requests
const response = await apiClient.post('/endpoint', data, {
  queueOffline: true,
  retry: RETRY_CONFIGS.DEFAULT,
  idempotencyKey: generateIdempotencyKey(),
});
```

### Connectivity Tracking
API calls automatically update connectivity state through the context:
- Successful calls reset consecutive failure counter
- Failed calls increment consecutive failure counter
- Degraded state triggers after threshold failures

## Best Practices

1. **Enable queueOffline for critical mutations** - Ensure important writes are preserved
2. **Display ConnectionStatus prominently** - Users should always see connectivity state
3. **Handle queued request feedback** - Inform users when requests are queued
4. **Monitor queue size** - Large queues may indicate persistent connectivity issues
5. **Test offline scenarios** - Verify queuing and retry behavior works correctly
6. **Use idempotency keys** - Prevent duplicate mutations on retry
7. **Provide manual retry option** - Allow users to trigger retry when needed

## Monitoring and Debugging

### Console Logging
The system logs important events:
- Connectivity state changes (online/offline)
- API call success/failure patterns
- Request queue operations
- Retry attempts

### Queue Inspection
```typescript
import { requestQueue } from '@/lib/utils/requestQueue';

// Inspect queued requests
const state = requestQueue.getState();
console.log('Queued requests:', state.requests);

// Clear queue if needed
requestQueue.clear();
```

## Benefits
- **User awareness** - Users always know their connectivity status
- **Data preservation** - Critical writes are queued during offline periods
- **Better UX** - No silent failures or confusing timeouts
- **Automatic recovery** - Queued requests retry automatically on reconnection
- **Configurable** - Easy to adjust thresholds and behavior
- **Persistent** - Queue survives page refreshes via localStorage

## Future Enhancements
- Add sync progress indicator for large queues
- Implement priority queuing for critical requests
- Add queue management UI (view/cancel individual requests)
- Integrate with service worker for background sync
- Add analytics for connectivity patterns
- Support for conflict resolution on concurrent edits
