import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from './api-client';
import * as errorReporter from '@/lib/telemetry/errorReporter';

describe('ApiClient secure response handling', () => {
  const originalFetch = global.fetch;
  const reportErrorSpy = vi.spyOn(errorReporter, 'reportError').mockImplementation(() => {});

  beforeEach(() => {
    reportErrorSpy.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should handle HTML error responses without throwing SyntaxError', async () => {
    const htmlPayload = '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>Proxy Error</body></html>';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(htmlPayload, {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const response = await apiClient.get('/test-endpoint');
    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(502);
    expect(response.error).toBe('502 Bad Gateway');
    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('502 Bad Gateway'),
      'api-client',
      'error',
      expect.objectContaining({
        endpoint: '/test-endpoint',
        status: 502,
        contentType: 'text/html',
      }),
    );
  });

  it('should handle 204 No Content empty responses gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    const response = await apiClient.delete('/items/123');
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(204);
    expect(response.data).toBeUndefined();
  });

  it('should detect file downloads and bypass JSON parsing', async () => {
    const pdfData = '%PDF-1.4 binary data stream';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(pdfData, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="export.pdf"',
        },
      }),
    );

    const response = await apiClient.get('/reports/download');
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.data).toEqual({ raw: pdfData });
  });

  it('should fallback to raw text extraction when JSON is malformed', async () => {
    const malformedJson = '{ "title": "test", broken json ';
    global.fetch = vi.fn().mockResolvedValue(
      new Response(malformedJson, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await apiClient.get('/malformed');
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ raw: malformedJson });
    expect(reportErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Received non-JSON response'),
      'api-client',
      'warning',
      expect.objectContaining({
        endpoint: '/malformed',
        status: 200,
      }),
    );
  });

  it('should process normal JSON API responses unchanged', async () => {
    const jsonPayload = { id: 1, name: 'Carbon Credits' };
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(jsonPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await apiClient.get<{ id: number; name: string }>('/credits/1');
    expect(response.success).toBe(true);
    expect(response.data).toEqual(jsonPayload);
  });
});
