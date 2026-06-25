import {
  CertificateFailureStatus,
  computeNextRetryAt,
  resolveRetryConfig,
} from './certificate-failure.interface';

describe('certificate-failure backoff helpers', () => {
  const baseConfig = {
    maxAttempts: 5,
    baseDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 60_000,
    alertThreshold: 10,
  };

  it('computes exponential backoff from the attempt count', () => {
    const from = new Date('2026-06-23T00:00:00.000Z');

    // attempt 0 -> base * 2^0 = 1000ms
    expect(computeNextRetryAt(0, baseConfig, from).getTime()).toBe(
      from.getTime() + 1000,
    );
    // attempt 2 -> base * 2^2 = 4000ms
    expect(computeNextRetryAt(2, baseConfig, from).getTime()).toBe(
      from.getTime() + 4000,
    );
  });

  it('caps backoff at maxDelayMs', () => {
    const from = new Date('2026-06-23T00:00:00.000Z');
    // attempt 20 would be astronomically large; should clamp to maxDelayMs
    expect(computeNextRetryAt(20, baseConfig, from).getTime()).toBe(
      from.getTime() + baseConfig.maxDelayMs,
    );
  });

  it('resolves config from env with safe defaults', () => {
    const prev = process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS;
    delete process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS;
    expect(resolveRetryConfig().maxAttempts).toBe(5);

    process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS = '9';
    expect(resolveRetryConfig().maxAttempts).toBe(9);

    // invalid values fall back to the default
    process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS = 'not-a-number';
    expect(resolveRetryConfig().maxAttempts).toBe(5);

    if (prev === undefined) delete process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS;
    else process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS = prev;
  });

  it('exposes the documented lifecycle statuses', () => {
    expect(CertificateFailureStatus.PENDING).toBe('pending');
    expect(CertificateFailureStatus.IN_PROGRESS).toBe('in_progress');
    expect(CertificateFailureStatus.FAILED).toBe('failed');
    expect(CertificateFailureStatus.RESOLVED).toBe('resolved');
  });
});
