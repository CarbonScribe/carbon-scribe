import { describe, it, expect, vi } from 'vitest';
import { validatePublicEnv, assertPublicEnv } from './validate';

const validEnv = {
  NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000',
  NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1',
  NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL:
    'https://stellar.expert/explorer/testnet/tx',
};

describe('validatePublicEnv', () => {
  it('passes with all required URLs present and valid', () => {
    const result = validatePublicEnv(validEnv);
    expect(result.errors).toEqual([]);
  });

  it('reports an error for each missing required variable', () => {
    const result = validatePublicEnv({});
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join('\n')).toContain('NEXT_PUBLIC_API_BASE_URL');
    expect(result.errors.join('\n')).toContain('NEXT_PUBLIC_API_URL');
    expect(result.errors.join('\n')).toContain(
      'NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL',
    );
  });

  it('errors on a malformed required URL', () => {
    const result = validatePublicEnv({ ...validEnv, NEXT_PUBLIC_API_URL: 'not-a-url' });
    expect(result.errors.some((e) => e.includes('NEXT_PUBLIC_API_URL'))).toBe(true);
  });

  it('errors on a non-http(s) protocol', () => {
    const result = validatePublicEnv({
      ...validEnv,
      NEXT_PUBLIC_API_URL: 'ftp://example.com',
    });
    expect(result.errors.some((e) => e.includes('http or https'))).toBe(true);
  });

  it('warns (does not error) on a trailing slash', () => {
    const result = validatePublicEnv({
      ...validEnv,
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/',
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes('trailing slash'))).toBe(true);
  });

  it('warns on an invalid NEXT_PUBLIC_ENVIRONMENT but does not error', () => {
    const result = validatePublicEnv({ ...validEnv, NEXT_PUBLIC_ENVIRONMENT: 'prod' });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes('NEXT_PUBLIC_ENVIRONMENT'))).toBe(
      true,
    );
  });

  it('warns on a malformed optional URL (Sentry DSN) without erroring', () => {
    const result = validatePublicEnv({ ...validEnv, NEXT_PUBLIC_SENTRY_DSN: 'oops' });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => w.includes('NEXT_PUBLIC_SENTRY_DSN'))).toBe(
      true,
    );
  });

  it('warns on a non-numeric optional numeric variable', () => {
    const result = validatePublicEnv({
      ...validEnv,
      NEXT_PUBLIC_MAX_RETRY_ATTEMPTS: 'three',
    });
    expect(result.warnings.some((w) => w.includes('NEXT_PUBLIC_MAX_RETRY_ATTEMPTS'))).toBe(
      true,
    );
  });
});

describe('assertPublicEnv', () => {
  it('throws with a clear message in strict mode when required vars are missing', () => {
    expect(() => assertPublicEnv({ env: {}, strict: true })).toThrow(
      /NEXT_PUBLIC_API_BASE_URL/,
    );
  });

  it('does not throw in non-strict mode but logs the error', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertPublicEnv({ env: {}, strict: false, logger })).not.toThrow();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('is bypassed entirely when SKIP_ENV_VALIDATION is set', () => {
    const result = assertPublicEnv({ env: { SKIP_ENV_VALIDATION: '1' }, strict: true });
    expect(result.errors).toEqual([]);
  });

  it('does not throw when configuration is valid', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    expect(() => assertPublicEnv({ env: validEnv, strict: true, logger })).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
