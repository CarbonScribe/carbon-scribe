/**
 * Exponential backoff with jitter for transient HTTP failures (#717).
 */

export interface RetryOptions {
  /** Maximum attempts including the first try. Default 3. */
  retries?: number;
  /** Base delay in ms before first retry. Default 300. */
  baseDelayMs?: number;
  /** Cap on delay. Default 5000. */
  maxDelayMs?: number;
  /** Override which HTTP methods may retry. */
  methods?: string[];
  /** Force-enable retries for this call even for non-idempotent methods. */
  force?: boolean;
}

export const DEFAULT_RETRY: Required<
  Pick<RetryOptions, 'retries' | 'baseDelayMs' | 'maxDelayMs'>
> & { methods: string[] } = {
  retries: 3,
  baseDelayMs: 300,
  maxDelayMs: 5000,
  methods: ['get', 'head', 'options', 'put', 'delete'],
};

const RETRYABLE_STATUS = new Set([408, 425, 429, 502, 503, 504]);

export function isRetryableMethod(method?: string, opts?: RetryOptions): boolean {
  if (opts?.force) return true;
  const m = (method || 'get').toLowerCase();
  const allowed = opts?.methods ?? DEFAULT_RETRY.methods;
  return allowed.includes(m);
}

export function isRetryableError(error: {
  response?: { status?: number };
  code?: string;
  message?: string;
}): boolean {
  const status = error.response?.status;
  if (status !== undefined) {
    // Never retry 4xx except a few transient ones
    if (status >= 400 && status < 500 && !RETRYABLE_STATUS.has(status)) {
      return false;
    }
    return RETRYABLE_STATUS.has(status) || status >= 500;
  }
  // Network errors (no response)
  const code = error.code || '';
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ERR_NETWORK' ||
    code === 'ECONNRESET'
  ) {
    return true;
  }
  const msg = (error.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('timeout');
}

export function backoffDelay(
  attempt: number,
  baseDelayMs = DEFAULT_RETRY.baseDelayMs,
  maxDelayMs = DEFAULT_RETRY.maxDelayMs,
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.random() * exp * 0.2;
  return Math.floor(exp + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
