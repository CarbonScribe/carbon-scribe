import { describe, it, expect } from 'vitest';
import {
  isJsonResponse,
  isHtmlResponse,
  isEmptyResponse,
  isBinaryOrStreamResponse,
  safeTextResponse,
  getResponseBodyPreview,
  parseResponseBody,
} from './responseParser';

describe('responseParser', () => {
  describe('isJsonResponse', () => {
    it('should detect standard application/json Content-Type', () => {
      expect(isJsonResponse('application/json')).toBe(true);
      expect(isJsonResponse('application/json; charset=utf-8')).toBe(true);
    });

    it('should detect +json structured Content-Type variants', () => {
      expect(isJsonResponse('application/problem+json')).toBe(true);
      expect(isJsonResponse('application/vnd.api+json')).toBe(true);
    });

    it('should return false for non-JSON Content-Types', () => {
      expect(isJsonResponse('text/html')).toBe(false);
      expect(isJsonResponse('text/plain')).toBe(false);
      expect(isJsonResponse('application/octet-stream')).toBe(false);
      expect(isJsonResponse(null)).toBe(false);
      expect(isJsonResponse(undefined)).toBe(false);
    });

    it('should handle Headers and Response instances', () => {
      const headers = new Headers({ 'content-type': 'application/json' });
      expect(isJsonResponse(headers)).toBe(true);

      const response = new Response('{}', { headers: { 'content-type': 'application/json' } });
      expect(isJsonResponse(response)).toBe(true);
    });
  });

  describe('isHtmlResponse', () => {
    it('should detect HTML from Content-Type header', () => {
      expect(isHtmlResponse('text/html')).toBe(true);
      expect(isHtmlResponse('application/xhtml+xml')).toBe(true);
    });

    it('should detect HTML from body content snippets', () => {
      expect(isHtmlResponse(undefined, '<!DOCTYPE html><html><body>Error</body></html>')).toBe(true);
      expect(isHtmlResponse(undefined, '<html><head><title>502 Bad Gateway</title></head></html>')).toBe(true);
      expect(isHtmlResponse(undefined, '<div><h1>Error</h1></div>')).toBe(true);
    });

    it('should return false for normal text or JSON strings', () => {
      expect(isHtmlResponse('application/json', '{"error": "bad request"}')).toBe(false);
      expect(isHtmlResponse('text/plain', 'Simple text error')).toBe(false);
    });
  });

  describe('isEmptyResponse', () => {
    it('should return true for 204 No Content status', () => {
      const res = new Response(null, { status: 204 });
      expect(isEmptyResponse(res)).toBe(true);
    });

    it('should return true for 205 Reset Content status', () => {
      const res = new Response(null, { status: 205 });
      expect(isEmptyResponse(res)).toBe(true);
    });

    it('should return true for content-length: 0', () => {
      const res = new Response('', { headers: { 'content-length': '0' } });
      expect(isEmptyResponse(res)).toBe(true);
    });

    it('should return true for empty rawText', () => {
      const res = new Response('', { status: 200 });
      expect(isEmptyResponse(res, '')).toBe(true);
      expect(isEmptyResponse(res, '   ')).toBe(true);
    });

    it('should return false when response has non-empty body', () => {
      const res = new Response('data', { status: 200 });
      expect(isEmptyResponse(res, 'data')).toBe(false);
    });
  });

  describe('isBinaryOrStreamResponse', () => {
    it('should detect Content-Disposition attachment', () => {
      const res = new Response('binary', {
        headers: { 'content-disposition': 'attachment; filename="report.pdf"' },
      });
      expect(isBinaryOrStreamResponse(res)).toBe(true);
    });

    it('should detect binary Content-Types', () => {
      expect(isBinaryOrStreamResponse('application/octet-stream')).toBe(true);
      expect(isBinaryOrStreamResponse('application/pdf')).toBe(true);
      expect(isBinaryOrStreamResponse('application/zip')).toBe(true);
      expect(isBinaryOrStreamResponse('image/png')).toBe(true);
      expect(isBinaryOrStreamResponse('text/event-stream')).toBe(true);
    });

    it('should return false for JSON and text Content-Types', () => {
      expect(isBinaryOrStreamResponse('application/json')).toBe(false);
      expect(isBinaryOrStreamResponse('text/html')).toBe(false);
      expect(isBinaryOrStreamResponse('text/plain')).toBe(false);
    });
  });

  describe('safeTextResponse', () => {
    it('should wrap string into raw object property', () => {
      expect(safeTextResponse('hello world')).toEqual({ raw: 'hello world' });
    });
  });

  describe('getResponseBodyPreview', () => {
    it('should truncate text longer than max length', () => {
      const longText = 'a'.repeat(300);
      const preview = getResponseBodyPreview(longText, 100);
      expect(preview.length).toBe(103); // 100 chars + '...'
      expect(preview.endsWith('...')).toBe(true);
    });

    it('should normalize whitespace in preview', () => {
      const multiline = 'line1\n  line2\n\t line3';
      expect(getResponseBodyPreview(multiline)).toBe('line1 line2 line3');
    });
  });

  describe('parseResponseBody', () => {
    it('should parse valid JSON response', async () => {
      const res = new Response(JSON.stringify({ success: true, count: 5 }), {
        headers: { 'content-type': 'application/json' },
      });
      const parsed = await parseResponseBody<{ success: boolean; count: number }>(res);
      expect(parsed.isJson).toBe(true);
      expect(parsed.data).toEqual({ success: true, count: 5 });
    });

    it('should handle 204 No Content gracefully', async () => {
      const res = new Response(null, { status: 204 });
      const parsed = await parseResponseBody(res);
      expect(parsed.isEmpty).toBe(true);
      expect(parsed.data).toBeNull();
    });

    it('should handle HTML error responses without throwing', async () => {
      const html = '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head></html>';
      const res = new Response(html, {
        status: 502,
        headers: { 'content-type': 'text/html' },
      });
      const parsed = await parseResponseBody(res);
      expect(parsed.isHtml).toBe(true);
      expect(parsed.isJson).toBe(false);
      expect(parsed.data).toEqual({ raw: html });
    });

    it('should handle malformed JSON gracefully', async () => {
      const invalidJson = '{ bad json: 123 ';
      const res = new Response(invalidJson, {
        headers: { 'content-type': 'application/json' },
      });
      const parsed = await parseResponseBody(res);
      expect(parsed.isJson).toBe(false);
      expect(parsed.data).toEqual({ raw: invalidJson });
    });

    it('should handle binary responses', async () => {
      const res = new Response('PDF binary data', {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="doc.pdf"',
        },
      });
      const parsed = await parseResponseBody(res);
      expect(parsed.isBinary).toBe(true);
      expect(parsed.data).toEqual({ raw: 'PDF binary data' });
    });
  });
});
