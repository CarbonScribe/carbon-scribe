import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest, ApiError } from './http';
import * as errorReporter from '@/lib/telemetry/errorReporter';
import { ErrorCode } from '@/lib/utils/errorParser';

// One shared spy for the whole file. Re-spying inside a later describe would
// replace this binding and silently leave earlier assertions with zero calls.
const reportErrorSpy = vi.spyOn(errorReporter, 'reportError').mockImplementation(() => {});

describe('apiRequest secure non-JSON handling', () => {
  beforeEach(() => {
    reportErrorSpy.mockClear();
  });

  it('should parse valid JSON response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ key: 'value' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await apiRequest<{ key: string }>('/test', {}, { fetchImpl });
    expect(result).toEqual({ key: 'value' });
  });

  it('should handle HTML 500 error page without throwing SyntaxError and report preview telemetry', async () => {
    const htmlBody = '<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head></html>';
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(htmlBody, {
        status: 500,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(apiRequest('/test', {}, { fetchImpl })).rejects.toThrow('500 Internal Server Error');
    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      'http',
      'error',
      expect.objectContaining({
        path: '/test',
        status: 500,
        contentType: 'text/html',
      }),
    );
  });

  it('should return raw text object when content-type is non-JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('Plain text response', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    const result = await apiRequest<{ raw: string }>('/text', {}, { fetchImpl });
    expect(result).toEqual({ raw: 'Plain text response' });
    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Received non-JSON response'),
      'http',
      'warning',
      expect.objectContaining({
        path: '/text',
        status: 200,
        contentType: 'text/plain',
      }),
    );
  });
});

describe('apiRequest rate limiting', () => {
  const rateLimitedResponse = (retryAfter: string) =>
    new Response(JSON.stringify({ message: 'Too many attempts' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'Retry-After': retryAfter,
      },
    });

  beforeEach(() => {
    reportErrorSpy.mockClear();
  });

  it('classifies 429 as RATE_LIMITED and attaches the Retry-After window', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(rateLimitedResponse('12'));

    const error: any = await apiRequest(
      '/api/v1/auth/login',
      { method: 'POST' },
      { fetchImpl },
    ).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.parsed.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.retryAfterMs).toBe(12_000);
    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      'http',
      'warning',
      expect.objectContaining({ status: 429, retryAfterMs: 12_000 }),
    );
  });

  it('never retries a POST after 429, even with retry options', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(rateLimitedResponse('1'));

    await expect(
      apiRequest(
        '/api/v1/auctions/1/bids',
        { method: 'POST', body: '{}' },
        { fetchImpl, retry: { maxAttempts: 3, initialDelayMs: 1 } },
      ),
    ).rejects.toBeInstanceOf(ApiError);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries an idempotent GET once, after the Retry-After delay', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(rateLimitedResponse('2'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );

      const promise = apiRequest<{ ok: boolean }>(
        '/api/v1/auctions',
        {},
        { fetchImpl },
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      await expect(promise).resolves.toEqual({ ok: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
