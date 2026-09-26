/**
 * Retry utility with exponential backoff for API requests
 * Handles transient network failures and 5xx server errors
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: Number(process.env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS) || 3,
  initialDelayMs: Number(process.env.NEXT_PUBLIC_RETRY_INITIAL_DELAY_MS) || 1000,
  maxDelayMs: Number(process.env.NEXT_PUBLIC_RETRY_MAX_DELAY_MS) || 30000,
  backoffMultiplier: Number(process.env.NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER) || 2,
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Network errors (TypeError from fetch)
  if (error instanceof TypeError) {
    return true;
  }

  // AbortError (timeout)
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  // 5xx server errors are retryable
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // 408 Request Timeout is retryable
  if (statusCode === 408) {
    return true;
  }

  // 429 Too Many Requests is retryable
  if (statusCode === 429) {
    return true;
  }

  return false;
}

/**
 * Check if a status code is a client error (non-retryable)
 */
export function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Extract status code from error if available
      let statusCode: number | undefined;
      if (error && typeof error === 'object' && 'status' in error) {
        statusCode = (error as any).status;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(error, statusCode)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        throw lastError;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      console.warn(
        `Request failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${delay}ms...`,
        lastError.message,
      );

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt, lastError);
      }

      await sleep(delay);
    }
  }

  throw lastError || new Error('Max retry attempts exceeded');
}

/**
 * Generate an idempotency key for mutation requests
 * Uses a combination of timestamp and random string
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Retry configuration for different request types
 */
export const RETRY_CONFIGS = {
  // Default retry config
  DEFAULT: DEFAULT_RETRY_CONFIG,

  // Aggressive retry for critical operations
  AGGRESSIVE: {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },

  // Conservative retry for non-critical operations
  CONSERVATIVE: {
    maxAttempts: 2,
    initialDelayMs: 2000,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  },

  // No retry for mutations (handled via idempotency)
  NO_RETRY: {
    maxAttempts: 1,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
  },
} as const;
