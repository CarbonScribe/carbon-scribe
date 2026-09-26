/**
 * Utility functions for detection and safe parsing of non-JSON and varied API responses.
 * Protects clients from crashing when backend returns HTML, empty bodies, file streams, or proxy errors.
 */

export interface ParsedResponseBody<T = unknown> {
  data: T | { raw: string } | null;
  raw: string;
  isJson: boolean;
  isHtml: boolean;
  isEmpty: boolean;
  isBinary: boolean;
  contentType: string;
  preview?: string;
}

/**
 * Extract Content-Type header string from Response, Headers, or raw string.
 */
function getContentTypeString(
  target: Response | Headers | string | null | undefined,
): string {
  if (!target) return '';
  if (typeof target === 'string') return target.toLowerCase();
  if (target instanceof Headers || (typeof (target as any).get === 'function')) {
    return ((target as any).get('content-type') || '').toLowerCase();
  }
  if (target && typeof target === 'object' && 'headers' in target) {
    const headers = (target as Response).headers;
    if (headers && typeof headers.get === 'function') {
      return (headers.get('content-type') || '').toLowerCase();
    }
  }
  return '';
}

/**
 * Check if Content-Type indicates a JSON response (application/json, application/problem+json, etc.)
 */
export function isJsonResponse(
  target: Response | Headers | string | null | undefined,
): boolean {
  const contentType = getContentTypeString(target);
  return contentType.includes('application/json') || contentType.includes('+json');
}

/**
 * Check if Content-Type or body text indicates an HTML response.
 */
export function isHtmlResponse(
  target: Response | Headers | string | null | undefined,
  bodyText?: string,
): boolean {
  const contentType = getContentTypeString(target);
  if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
    return true;
  }
  if (bodyText) {
    const trimmed = bodyText.trim().toLowerCase();
    if (
      trimmed.startsWith('<!doctype html') ||
      trimmed.startsWith('<html') ||
      trimmed.includes('<head>') ||
      trimmed.includes('<body>') ||
      trimmed.includes('<title>') ||
      trimmed.includes('<h1>') ||
      trimmed.includes('<h2>') ||
      trimmed.includes('<h3>') ||
      trimmed.includes('<div>') ||
      trimmed.includes('<p>')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if the response is empty (204 No Content, 205 Reset Content, zero content-length, or empty body).
 */
export function isEmptyResponse(response: Response, rawText?: string): boolean {
  if (!response) return true;
  if (response.status === 204 || response.status === 205) {
    return true;
  }
  const headers = response.headers;
  const contentLength = headers && typeof headers.get === 'function' ? headers.get('content-length') : null;
  if (contentLength === '0') {
    return true;
  }
  if (rawText !== undefined && rawText.trim().length === 0) {
    return true;
  }
  return false;
}

/**
 * Check if response is a file download, stream, or binary data.
 */
export function isBinaryOrStreamResponse(
  target: Response | Headers | string | null | undefined,
): boolean {
  if (target && typeof target === 'object' && 'headers' in target) {
    const headers = (target as Response).headers;
    const disposition = headers && typeof headers.get === 'function' ? headers.get('content-disposition') || '' : '';
    if (disposition.toLowerCase().includes('attachment')) {
      return true;
    }
  }
  const contentType = getContentTypeString(target);
  if (!contentType) return false;

  const binaryTypes = [
    'application/octet-stream',
    'application/pdf',
    'application/zip',
    'application/x-tar',
    'application/gzip',
    'image/',
    'audio/',
    'video/',
    'text/event-stream',
    'multipart/',
  ];

  return binaryTypes.some((type) => contentType.includes(type));
}

/**
 * Fallback helper for non-JSON responses.
 */
export function safeTextResponse(text: string): { raw: string } {
  return { raw: text };
}

/**
 * Generate a truncated preview of the response body for debugging and logging.
 */
export function getResponseBodyPreview(text: string, maxLength: number = 200): string {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}...`;
}

/**
 * Parse response body safely with content-type detection and multiple fallback strategies.
 */
export async function parseResponseBody<T = unknown>(
  response: Response,
): Promise<ParsedResponseBody<T>> {
  const contentType = getContentTypeString(response);
  const rawText = (response && typeof response.text === 'function') ? await response.text() : '';

  const empty = isEmptyResponse(response, rawText);
  if (empty) {
    return {
      data: null,
      raw: '',
      isJson: false,
      isHtml: false,
      isEmpty: true,
      isBinary: false,
      contentType,
      preview: '',
    };
  }

  const binary = isBinaryOrStreamResponse(response);
  if (binary) {
    return {
      data: safeTextResponse(rawText) as any,
      raw: rawText,
      isJson: false,
      isHtml: false,
      isEmpty: false,
      isBinary: true,
      contentType,
      preview: getResponseBodyPreview(rawText),
    };
  }

  const jsonHeader = isJsonResponse(contentType);
  const htmlHeader = isHtmlResponse(contentType, rawText);

  // Attempt JSON parse if content-type indicates JSON or if it's not explicitly HTML/binary
  if (jsonHeader || (!htmlHeader && !binary)) {
    try {
      const parsedData = JSON.parse(rawText);
      return {
        data: parsedData as T,
        raw: rawText,
        isJson: true,
        isHtml: false,
        isEmpty: false,
        isBinary: false,
        contentType,
      };
    } catch {
      // JSON parsing failed — fallback gracefully to raw text without throwing SyntaxError
    }
  }

  const htmlDetected = isHtmlResponse(contentType, rawText);

  return {
    data: safeTextResponse(rawText) as any,
    raw: rawText,
    isJson: false,
    isHtml: htmlDetected,
    isEmpty: false,
    isBinary: false,
    contentType,
    preview: getResponseBodyPreview(rawText),
  };
}
