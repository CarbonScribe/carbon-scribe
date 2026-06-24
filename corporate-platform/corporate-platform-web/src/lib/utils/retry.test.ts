import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  isRetryableError,
  isClientError,
  generateIdempotencyKey,
  RETRY_CONFIGS,
} from './retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });
      
      // First attempt fails
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Second attempt after delay
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('Not retryable');
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 }))
        .rejects.toThrow('Not retryable');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should stop retrying after max attempts', async () => {
      const error = new TypeError('Network error');
      const fn = vi.fn().mockRejectedValue(error);
      
      // Use expect().rejects with the promise directly
      const promise = withRetry(fn, { maxAttempts: 2, initialDelayMs: 100 });
      
      // Advance timers to trigger retries
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);
      
      // Now the promise should be rejected
      await expect(promise).rejects.toThrow('Network error');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, { 
        maxAttempts: 3, 
        initialDelayMs: 100, 
        backoffMultiplier: 2 
      });
      
      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Second attempt after 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Third attempt after 200ms (100 * 2)
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should respect max delay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, { 
        maxAttempts: 3, 
        initialDelayMs: 100, 
        backoffMultiplier: 10,
        maxDelayMs: 150
      });
      
      // First attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Second attempt after 100ms
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Third attempt after 150ms (capped at maxDelayMs)
      await vi.advanceTimersByTimeAsync(150);
      expect(fn).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValue('success');
      
      const promise = withRetry(fn, { 
        maxAttempts: 3, 
        initialDelayMs: 100,
        onRetry
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await promise;
      
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('isRetryableError', () => {
    it('should return true for TypeError (network errors)', () => {
      const error = new TypeError('Failed to fetch');
      expect(isRetryableError(error, 0)).toBe(true);
    });

    it('should return true for AbortError (timeout)', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      expect(isRetryableError(error, 0)).toBe(true);
    });

    it('should return true for 5xx errors', () => {
      expect(isRetryableError({}, 500)).toBe(true);
      expect(isRetryableError({}, 502)).toBe(true);
      expect(isRetryableError({}, 503)).toBe(true);
    });

    it('should return true for 408 Request Timeout', () => {
      expect(isRetryableError({}, 408)).toBe(true);
    });

    it('should return true for 429 Too Many Requests', () => {
      expect(isRetryableError({}, 429)).toBe(true);
    });

    it('should return false for 4xx errors (except 408 and 429)', () => {
      expect(isRetryableError({}, 400)).toBe(false);
      expect(isRetryableError({}, 401)).toBe(false);
      expect(isRetryableError({}, 403)).toBe(false);
      expect(isRetryableError({}, 404)).toBe(false);
      expect(isRetryableError({}, 422)).toBe(false);
    });

    it('should return false for other errors', () => {
      const error = new Error('Some error');
      expect(isRetryableError(error, 200)).toBe(false);
    });
  });

  describe('isClientError', () => {
    it('should return true for 4xx errors', () => {
      expect(isClientError(400)).toBe(true);
      expect(isClientError(401)).toBe(true);
      expect(isClientError(403)).toBe(true);
      expect(isClientError(404)).toBe(true);
      expect(isClientError(422)).toBe(true);
    });

    it('should return false for 408 (retryable)', () => {
      expect(isClientError(408)).toBe(false);
    });

    it('should return false for 429 (retryable)', () => {
      expect(isClientError(429)).toBe(false);
    });

    it('should return false for 5xx errors', () => {
      expect(isClientError(500)).toBe(false);
      expect(isClientError(503)).toBe(false);
    });

    it('should return false for 2xx and 3xx', () => {
      expect(isClientError(200)).toBe(false);
      expect(isClientError(304)).toBe(false);
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate unique keys', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      
      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    });

    it('should generate keys with timestamp prefix', () => {
      const key = generateIdempotencyKey();
      const parts = key.split('-');
      
      expect(parts.length).toBe(2);
      // First part should be a timestamp (base36)
      expect(parts[0]).toMatch(/^[a-z0-9]+$/);
      // Second part should be random
      expect(parts[1]).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('RETRY_CONFIGS', () => {
    it('should have DEFAULT config', () => {
      expect(RETRY_CONFIGS.DEFAULT).toBeDefined();
      expect(RETRY_CONFIGS.DEFAULT.maxAttempts).toBeGreaterThan(0);
      expect(RETRY_CONFIGS.DEFAULT.initialDelayMs).toBeGreaterThan(0);
    });

    it('should have AGGRESSIVE config with more attempts', () => {
      expect(RETRY_CONFIGS.AGGRESSIVE.maxAttempts).toBeGreaterThan(RETRY_CONFIGS.DEFAULT.maxAttempts);
      expect(RETRY_CONFIGS.AGGRESSIVE.initialDelayMs).toBeLessThan(RETRY_CONFIGS.DEFAULT.initialDelayMs);
    });

    it('should have CONSERVATIVE config with fewer attempts', () => {
      expect(RETRY_CONFIGS.CONSERVATIVE.maxAttempts).toBeLessThan(RETRY_CONFIGS.DEFAULT.maxAttempts);
    });

    it('should have NO_RETRY config', () => {
      expect(RETRY_CONFIGS.NO_RETRY.maxAttempts).toBe(1);
      expect(RETRY_CONFIGS.NO_RETRY.initialDelayMs).toBe(0);
    });
  });
});
