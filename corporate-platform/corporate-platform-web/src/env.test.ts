import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('env validation', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL;
    delete process.env.NEXT_PUBLIC_TOKEN_REFRESH_BUFFER;
    delete process.env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS;
    delete process.env.NEXT_PUBLIC_RETRY_INITIAL_DELAY_MS;
    delete process.env.NEXT_PUBLIC_RETRY_MAX_DELAY_MS;
    delete process.env.NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER;
    delete process.env.NEXT_PUBLIC_DEGRADED_THRESHOLD;
    delete process.env.NEXT_PUBLIC_DEGRADED_RECOVERY_THRESHOLD;
    delete process.env.NEXT_PUBLIC_CONNECTIVITY_CHECK_INTERVAL;
    delete process.env.NEXT_PUBLIC_MAX_QUEUE_SIZE;
    delete process.env.NEXT_PUBLIC_QUEUE_MAX_RETRIES;
    delete process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT;
    delete process.env.NEXT_PUBLIC_ERROR_RATE_LIMIT_MAX;
    delete process.env.NEXT_PUBLIC_ERROR_RATE_LIMIT_WINDOW_MS;
    delete process.env.NEXT_PUBLIC_ERROR_DEV_MIN_SEVERITY;
    delete process.env.NEXT_PUBLIC_SESSION_EXPIRY_WARNING_MINUTES;
    delete process.env.NEXT_PUBLIC_SESSION_GRACE_SECONDS;
    delete process.env.NEXT_PUBLIC_ENVIRONMENT;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('applies correct defaults when all vars are unset', async () => {
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe('http://localhost:4000');
    expect(env.NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL).toBe(
      'https://stellar.expert/explorer/testnet/tx',
    );
    expect(env.NEXT_PUBLIC_TOKEN_REFRESH_BUFFER).toBe(60);
    expect(env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS).toBe(3);
    expect(env.NEXT_PUBLIC_RETRY_INITIAL_DELAY_MS).toBe(1000);
    expect(env.NEXT_PUBLIC_RETRY_MAX_DELAY_MS).toBe(30000);
    expect(env.NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER).toBe(2);
    expect(env.NEXT_PUBLIC_DEGRADED_THRESHOLD).toBe(3);
    expect(env.NEXT_PUBLIC_DEGRADED_RECOVERY_THRESHOLD).toBe(2);
    expect(env.NEXT_PUBLIC_CONNECTIVITY_CHECK_INTERVAL).toBe(30000);
    expect(env.NEXT_PUBLIC_MAX_QUEUE_SIZE).toBe(100);
    expect(env.NEXT_PUBLIC_QUEUE_MAX_RETRIES).toBe(3);
    expect(env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT).toBe('');
    expect(env.NEXT_PUBLIC_ERROR_RATE_LIMIT_MAX).toBe(50);
    expect(env.NEXT_PUBLIC_ERROR_RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.NEXT_PUBLIC_ERROR_DEV_MIN_SEVERITY).toBe('warning');
    expect(env.NEXT_PUBLIC_SESSION_EXPIRY_WARNING_MINUTES).toBe(5);
    expect(env.NEXT_PUBLIC_SESSION_GRACE_SECONDS).toBe(30);
    expect(env.NEXT_PUBLIC_ENVIRONMENT).toBe('development');
  });

  it('coerces string numbers to numbers', async () => {
    process.env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS = '123';
    process.env.NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER = '1.5';
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS).toBe(123);
    expect(env.NEXT_PUBLIC_RETRY_BACKOFF_MULTIPLIER).toBe(1.5);
  });

  it('accepts valid URL values', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL = 'https://stellar.example.com/explorer';
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe('https://api.example.com');
    expect(env.NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL).toBe('https://stellar.example.com/explorer');
  });

  it('passes with optional error reporting endpoint empty', async () => {
    process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT = '';
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT).toBe('');
  });

  it('passes with optional error reporting endpoint as valid URL', async () => {
    process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT = 'https://errors.example.com/ingest';
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT).toBe('https://errors.example.com/ingest');
  });

  it('rejects invalid URL for required URL field', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'not-a-url';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('./env');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('NEXT_PUBLIC_API_BASE_URL');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects invalid enum value for NEXT_PUBLIC_ENVIRONMENT', async () => {
    process.env.NEXT_PUBLIC_ENVIRONMENT = 'invalid';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('./env');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('NEXT_PUBLIC_ENVIRONMENT');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('accepts valid environment enum values', async () => {
    process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
    const { env } = await import('./env');
    expect(env.NEXT_PUBLIC_ENVIRONMENT).toBe('production');
  });

  it('rejects invalid severity enum value', async () => {
    process.env.NEXT_PUBLIC_ERROR_DEV_MIN_SEVERITY = 'critical';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('./env');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('NEXT_PUBLIC_ERROR_DEV_MIN_SEVERITY');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects negative numbers for numeric fields', async () => {
    process.env.NEXT_PUBLIC_MAX_RETRY_ATTEMPTS = '-1';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('./env');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('NEXT_PUBLIC_MAX_RETRY_ATTEMPTS');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('rejects zero for integer-positive fields', async () => {
    process.env.NEXT_PUBLIC_TOKEN_REFRESH_BUFFER = '0';
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('./env');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).toContain('NEXT_PUBLIC_TOKEN_REFRESH_BUFFER');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
