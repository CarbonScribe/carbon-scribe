import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest, ApiError } from './http';
import * as errorReporter from '@/lib/telemetry/errorReporter';

describe('apiRequest secure non-JSON handling', () => {
  const reportErrorSpy = vi.spyOn(errorReporter, 'reportError').mockImplementation(() => {});

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
