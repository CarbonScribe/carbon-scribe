/**
 * Utility functions for adding cache headers to API responses
 */

import { CACHE_CONFIG } from './cache-config';

export interface CacheHeaders {
  'Cache-Control': string;
  'CDN-Cache-Control'?: string;
  'Vary'?: string;
}

/**
 * Get cache headers for different response types
 */
export function getCacheHeaders(
  type: keyof typeof CACHE_CONFIG,
  additionalHeaders?: Record<string, string>
): CacheHeaders {
  const base = CACHE_CONFIG[type];
  const headers: CacheHeaders = {
    'Cache-Control': base['Cache-Control'],
  };

  // Add CDN-specific headers for production
  if (process.env.NODE_ENV === 'production') {
    headers['CDN-Cache-Control'] = base['Cache-Control'];
  }

  // Add Vary header for compression and user-agent
  headers['Vary'] = 'Accept-Encoding, User-Agent';

  // Merge additional headers
  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  return headers;
}

/**
 * Apply cache headers to a Response object
 */
export function applyCacheHeaders(
  response: Response,
  type: keyof typeof CACHE_CONFIG,
  additionalHeaders?: Record<string, string>
): Response {
  const headers = getCacheHeaders(type, additionalHeaders);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Get cache headers for API responses based on method
 */
export function getApiCacheHeaders(method: string): CacheHeaders {
  if (method === 'GET') {
    return getCacheHeaders('API_GET');
  }
  return getCacheHeaders('API_MUTATION');
}