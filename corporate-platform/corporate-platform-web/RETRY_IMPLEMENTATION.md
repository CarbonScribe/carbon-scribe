# API Request Retry and Backoff Implementation

## Overview
This implementation adds bounded retry behavior with exponential backoff for transient network and 5xx failures in the CarbonScribe corporate platform web application. The system improves user experience during temporary service disruptions and reduces unnecessary error reports.

## Files Created/Modified

### New Files
1. **src/lib/utils/retry.ts** - Retry utility with exponential backoff logic
2. **src/lib/utils/retry.test.ts** - Comprehensive test suite for retry logic
3. **src/components/common/RetryIndicator.tsx** - Retry status indicator and toast notification components

### Modified Files
1. **.env.example** - Added retry configuration environment variables
2. **src/lib/api/http.ts** - Integrated retry logic and idempotency key support
3. **src/services/api-client.ts** - Integrated retry logic and idempotency key support
4. **src/lib/utils/errorParser.ts** - Added retryable error detection functions

## Configuration

### Environment Variables
Add these to your `.env` file:

```bash
# API Retry Configuration
NEXT_PUBLIC_MAX_RETRY_ATTEMPTS=3
NEXT_PUBLIC_RETRY_INITIAL_DELAY_MS=1000
NEXT_PUBLIC_RETRY_MAX_DELAY_MS=30000
NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER=2
```

### Retry Parameters
- **MAX_RETRY_ATTEMPTS** (default: 3) - Maximum number of retry attempts
- **RETRY_INITIAL_DELAY_MS** (default: 1000) - Initial delay before first retry in milliseconds
- **RETRY_MAX_DELAY_MS** (default: 30000) - Maximum delay between retries in milliseconds
- **RETRY_BACKOFF_MULTIPLIER** (default: 2) - Multiplier for exponential backoff

## Retry Behavior

### Retryable Errors
The system retries on the following error types:
- **Network errors** (TypeError from fetch failures)
- **Timeout errors** (AbortError)
- **5xx server errors** (500, 502, 503, 504)
- **408 Request Timeout**
- **429 Too Many Requests**

### Non-Retryable Errors
The system does NOT retry on:
- **4xx client errors** (400, 401, 403, 404, 422, etc.)
- **Validation errors**
- **Authentication errors**
- **Not found errors**

### Exponential Backoff
Retry delays follow exponential backoff:
- Attempt 1: Initial delay (default: 1000ms)
- Attempt 2: Initial delay × multiplier (default: 2000ms)
- Attempt 3: Previous delay × multiplier (default: 4000ms)
- Capped at max delay (default: 30000ms)

## Usage

### Basic Usage with API Client

```typescript
import { apiClient } from '@/services/api-client';
import { RETRY_CONFIGS } from '@/lib/utils/retry';

// GET request with default retry
const response = await apiClient.get('/data', {
  retry: RETRY_CONFIGS.DEFAULT,
});

// POST request with aggressive retry
const response = await apiClient.post('/create', data, {
  retry: RETRY_CONFIGS.AGGRESSIVE,
});

// Mutation with idempotency key
const response = await apiClient.post('/create', data, {
  retry: RETRY_CONFIGS.DEFAULT,
  idempotencyKey: generateIdempotencyKey(),
});
```

### Usage with HTTP Client

```typescript
import { apiRequest } from '@/lib/api/http';
import { generateIdempotencyKey } from '@/lib/utils/retry';

const data = await apiRequest('/endpoint', {
  method: 'POST',
  body: JSON.stringify(payload),
}, {
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  idempotencyKey: generateIdempotencyKey(),
});
```

### Custom Retry Configuration

```typescript
import { withRetry } from '@/lib/utils/retry';

const result = await withRetry(
  async () => {
    // Your async operation
    return await someAsyncFunction();
  },
  {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}:`, error.message);
    },
  }
);
```

### Retry Status Indicator

```tsx
import RetryIndicator, { RetryToast } from '@/components/common/RetryIndicator';

// Inline indicator
<RetryIndicator 
  isRetrying={isRetrying} 
  attempt={currentAttempt} 
  maxAttempts={3} 
/>

// Toast notification
<RetryToast 
  isRetrying={isRetrying}
  attempt={currentAttempt}
  maxAttempts={3}
  error={errorMessage}
/>
```

## Idempotency Keys

### What are Idempotency Keys?
Idempotency keys prevent duplicate operations when retrying mutation requests (POST, PUT, PATCH, DELETE). The same key ensures that if a request is retried, the backend will recognize it as a duplicate and not execute the operation twice.

### Generating Idempotency Keys

```typescript
import { generateIdempotencyKey } from '@/lib/utils/retry';

// Generate a unique idempotency key
const key = generateIdempotencyKey();

// Use it in your request
await apiClient.post('/create', data, {
  idempotencyKey: key,
});
```

### When to Use Idempotency Keys
- **POST requests** - Creating resources
- **PUT requests** - Updating resources
- **PATCH requests** - Partial updates
- **DELETE requests** - Deleting resources

**Do NOT use for:**
- **GET requests** - Safe by definition
- **HEAD requests** - Safe by definition
- **OPTIONS requests** - Safe by definition

## Predefined Retry Configurations

```typescript
import { RETRY_CONFIGS } from '@/lib/utils/retry';

// Default: 3 attempts, 1s initial delay, 30s max delay
RETRY_CONFIGS.DEFAULT

// Aggressive: 5 attempts, 500ms initial delay, 10s max delay
RETRY_CONFIGS.AGGRESSIVE

// Conservative: 2 attempts, 2s initial delay, 5s max delay
RETRY_CONFIGS.CONSERVATIVE

// No retry: 1 attempt, no delay
RETRY_CONFIGS.NO_RETRY
```

## Error Handling

### Differentiating Retryable vs Non-Retryable Errors

```typescript
import { isRetryableError, isClientError } from '@/lib/utils/retry';
import { isRetryableParsedError } from '@/lib/utils/errorParser';

// Check if an error is retryable
if (isRetryableError(error, statusCode)) {
  // Will be retried automatically
}

// Check if an error is a client error (non-retryable)
if (isClientError(statusCode)) {
  // Will not be retried
}

// Check parsed error
if (isRetryableParsedError(parsedError)) {
  // Will be retried automatically
}
```

## Testing

Run the retry logic tests:
```bash
npm test retry.test.ts
```

The test suite covers:
- Successful requests on first attempt
- Retry on retryable errors
- No retry on non-retryable errors
- Max attempt limits
- Exponential backoff timing
- Max delay capping
- onRetry callback invocation
- Error type detection
- Idempotency key generation

## Benefits
- **Improved resilience**: Handles transient network failures automatically
- **Better UX**: Users experience fewer errors during temporary outages
- **Reduced support burden**: Fewer error reports for transient issues
- **Configurable**: Easy to adjust retry behavior per use case
- **Safe**: Idempotency keys prevent duplicate mutations
- **Observable**: Retry attempts are logged and can be displayed to users

## Best Practices

1. **Use conservative defaults** for non-critical operations
2. **Use aggressive retry** for critical operations (e.g., payments)
3. **Always use idempotency keys** for mutation requests
4. **Provide user feedback** during retry attempts using RetryIndicator
5. **Log retry attempts** for debugging and monitoring
6. **Don't retry validation errors** - they won't succeed on retry
7. **Don't retry authentication errors** - user needs to re-authenticate
8. **Monitor retry rates** - high retry rates may indicate backend issues

## Monitoring

Retry attempts are logged to the console:
```
Request failed (attempt 1/3). Retrying in 1000ms... Error message
Retrying request to /endpoint (attempt 1)...
API Error [/endpoint] after retries: Error message
```

## Future Enhancements
- Add retry metrics tracking and analytics
- Integrate with error monitoring services (e.g., Sentry)
- Add circuit breaker pattern for cascading failures
- Support for custom retry strategies (e.g., jitter)
- Retry statistics dashboard
