import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression coverage for #555: reportError's payload must never carry a
// raw token or full user-profile value, regardless of what a call site
// passes in — enforced structurally in buildPayload/sanitizeMetadata, not
// just by auditing call sites.

const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('errorReporter redaction', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (global as any).fetch = fetchMock;
    vi.stubEnv('NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT', 'https://telemetry.example.com/errors');
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function importReportError() {
    const mod = await import('./errorReporter');
    return mod.reportError;
  }

  async function capturedPayload() {
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    return JSON.parse(fetchMock.mock.calls[0][1].body);
  }

  it('redacts a JWT-shaped string found in metadata', async () => {
    const reportError = await importReportError();

    reportError(new Error('boom'), 'test', 'error', { bodyPreview: `token=${FAKE_JWT}` });

    const payload = await capturedPayload();
    expect(payload.metadata.bodyPreview).not.toContain(FAKE_JWT);
    expect(payload.metadata.bodyPreview).toContain('[REDACTED_TOKEN]');
  });

  it('redacts well-known sensitive metadata keys entirely, leaving other keys untouched', async () => {
    const reportError = await importReportError();

    reportError(new Error('boom'), 'test', 'error', {
      token: 'super-secret-value',
      accessToken: 'also-secret',
      user: { email: 'user@example.com' },
      operation: 'login',
    });

    const payload = await capturedPayload();
    expect(payload.metadata.token).toBe('[REDACTED]');
    expect(payload.metadata.accessToken).toBe('[REDACTED]');
    expect(payload.metadata.user).toBe('[REDACTED]');
    expect(payload.metadata.operation).toBe('login');
  });

  it('redacts a JWT-shaped string in the error message itself', async () => {
    const reportError = await importReportError();

    reportError(`Request failed with Authorization: Bearer ${FAKE_JWT}`, 'test', 'error');

    const payload = await capturedPayload();
    expect(payload.error).not.toContain(FAKE_JWT);
    expect(payload.error).toContain('[REDACTED_TOKEN]');
  });

  it('redacts a JWT-shaped string in an Error stack trace', async () => {
    const reportError = await importReportError();
    const err = new Error('boom');
    err.stack = `Error: boom\n    at token ${FAKE_JWT}`;

    reportError(err, 'test', 'error');

    const payload = await capturedPayload();
    expect(payload.metadata.stack).not.toContain(FAKE_JWT);
  });

  it('does not redact ordinary, non-sensitive metadata', async () => {
    const reportError = await importReportError();

    reportError(new Error('boom'), 'test', 'error', { endpoint: '/api/v1/projects', status: 500 });

    const payload = await capturedPayload();
    expect(payload.metadata.endpoint).toBe('/api/v1/projects');
    expect(payload.metadata.status).toBe(500);
  });
});
