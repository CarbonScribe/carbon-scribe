import { describe, it, expect } from 'vitest';
import {
  backoffDelay,
  isRetryableError,
  isRetryableMethod,
} from './retry';

describe('API retry helpers (#717)', () => {
  it('treats GET as retryable and POST as not by default', () => {
    expect(isRetryableMethod('get')).toBe(true);
    expect(isRetryableMethod('POST')).toBe(false);
    expect(isRetryableMethod('post', { force: true })).toBe(true);
  });

  it('retries network and 503, never plain 400/404', () => {
    expect(isRetryableError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isRetryableError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableError({ response: { status: 502 } })).toBe(true);
    expect(isRetryableError({ response: { status: 400 } })).toBe(false);
    expect(isRetryableError({ response: { status: 404 } })).toBe(false);
    expect(isRetryableError({ response: { status: 401 } })).toBe(false);
  });

  it('backoff grows with attempt and stays under cap', () => {
    const d0 = backoffDelay(0, 100, 1000);
    const d2 = backoffDelay(2, 100, 1000);
    expect(d0).toBeGreaterThanOrEqual(100);
    expect(d2).toBeGreaterThanOrEqual(d0);
    expect(d2).toBeLessThanOrEqual(1000 * 1.2 + 1);
  });
});
