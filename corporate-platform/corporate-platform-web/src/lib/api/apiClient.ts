import { getAccessToken } from '@/lib/auth/token-storage';
import { parseApiError, ParsedError, ErrorCode } from '@/lib/utils/errorParser';
import { withRetry, isRetryableError, RetryOptions, generateIdempotencyKey } from '@/lib/utils/retry';
import { requestQueue } from '@/lib/utils/requestQueue';
import { reportError } from '@/lib/telemetry/errorReporter';
import { requestManager } from '@/lib/api/requestManager';
import { parseResponseBody } from '@/lib/api/responseParser';
import { getApiCacheHeaders } from '@/lib/cache/cache-headers';

/**
 * Base API Client for handling HTTP requests
 * Handles authentication, error handling, and response formatting
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isCancelled?: boolean;
  timestamp?: string;
  statusCode?: number;
  parsedError?: ParsedError;
  /** Whether the response was served from cache */
  fromCache?: boolean;
  /** Cache headers from the response */
  cacheHeaders?: Record<string, string>;
}

export interface ApiFetchOptions extends RequestInit {
  timeout?: number;
  retry?: RetryOptions;
  idempotencyKey?: string;
  queueOffline?: boolean; // Whether to queue request when offline
  signal?: AbortSignal;
  cancelOnRouteChange?: boolean;
  deduplicate?: boolean;
  /** Enable client-side caching for GET requests */
  cacheResponse?: boolean;
  /** Cache TTL in milliseconds (default: 30000) */
  cacheTTL?: number;
}

class ApiClient {
  private baseUrl: string;
  private responseCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get the authorization token from localStorage
   */
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return getAccessToken();
    }
    return null;
  }

  /**
   * Build headers with authentication
   */
  private buildHeaders(options?: ApiFetchOptions): Record<string, string> {
    const incomingHeaders = new Headers(options?.headers);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    incomingHeaders.forEach((value, key) => {
      headers[key] = value;
    });

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add idempotency key for mutation requests if provided
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    // Add cache control headers for client-side caching
    if (options?.cacheResponse && options?.method === 'GET') {
      headers['Cache-Control'] = 'max-age=30, stale-while-revalidate=60';
    }

    return headers;
  }

  /**
   * Get cache key for a request
   */
  private getCacheKey(url: string, options?: ApiFetchOptions): string {
    return `${options?.method || 'GET'}:${url}`;
  }

  /**
   * Check if cached response is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return false;
    const now = Date.now();
    return now - cached.timestamp < cached.ttl;
  }

  /**
   * Get cached response if available
   */
  private getCachedResponse<T>(cacheKey: string): ApiResponse<T> | null {
    if (!this.isCacheValid(cacheKey)) {
      this.responseCache.delete(cacheKey);
      return null;
    }
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    return {
      ...cached.data,
      fromCache: true,
    } as ApiResponse<T>;
  }

  /**
   * Cache a response
   */
  private cacheResponse(cacheKey: string, data: any, ttl: number): void {
    this.responseCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Make a generic fetch request
   */
  private async fetch<T>(
    endpoint: string,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const timeout = options?.timeout || 30000;

    // Check if offline and queueOffline is enabled for mutation requests
    const isMutation = options?.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    // Client-side caching for GET requests
    const isCacheable = options?.cacheResponse !== false && options?.method === 'GET';
    const cacheKey = this.getCacheKey(url, options);
    const cacheTTL = options?.cacheTTL || 30000;

    if (isCacheable) {
      const cached = this.getCachedResponse<T>(cacheKey);
      if (cached) {
        // Add cache headers to response
        const cacheHeaders: Record<string, string> = { ...getApiCacheHeaders('GET') };
        return {
          ...cached,
          cacheHeaders,
        };
      }
    }

    if (isOffline && isMutation && options?.queueOffline) {
      // Queue the request for later
      const headers = this.buildHeaders(options);
      requestQueue.enqueue({
        url,
        method: options.method || 'GET',
        headers,
        body: options?.body as string,
        maxRetries: 3,
      });
      
      return {
        success: false,
        error: 'You are offline. This request has been queued and will be retried when you reconnect.',
        statusCode: 0,
        timestamp: new Date().toISOString(),
        parsedError: {
          message: 'You are offline. This request has been queued and will be retried when you reconnect.',
          code: ErrorCode.NETWORK_ERROR,
          statusCode: 0,
        },
      };
    }

    const method = options?.method ?? 'GET';
    const isQuery = method === 'GET';
    const cancelOnRouteChange = options?.cancelOnRouteChange ?? isQuery;
    const deduplicate = options?.deduplicate ?? isQuery;
    const requestKey = requestManager.generateKey(method, url, options?.body);

    const executeRequest = async (): Promise<ApiResponse<T>> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Forward any caller-supplied AbortSignal so explicit cancellations
        // (e.g. rapid filter changes) abort the underlying fetch immediately
        // without waiting for the timeout to expire.
        const externalSignal = options?.signal;
        if (externalSignal) {
          if (externalSignal.aborted) {
            clearTimeout(timeoutId);
            controller.abort(externalSignal.reason);
          } else {
            externalSignal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeoutId);
                controller.abort(externalSignal.reason || 'Caller aborted');
              },
              { once: true },
            );
          }
        }

        if (cancelOnRouteChange) {
          requestManager.registerRequest(requestKey, controller, deduplicate);
        }

        const response = await fetch(url, {
          ...options,
          headers: this.buildHeaders(options),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (cancelOnRouteChange) {
          requestManager.unregisterRequest(requestKey);
        }

        const parsedResponse = await parseResponseBody<T>(response);

        // Telemetry warning tracking for non-JSON responses
        if (!parsedResponse.isJson && !parsedResponse.isEmpty && !parsedResponse.isBinary) {
          reportError(
            `Received non-JSON response (${parsedResponse.contentType || 'unknown'}) for ${method} ${endpoint}`,
            'api-client',
            'warning',
            {
              endpoint,
              status: response.status,
              contentType: parsedResponse.contentType,
              bodyPreview: parsedResponse.preview,
              isHtml: parsedResponse.isHtml,
            },
          );
        }

        if (!response.ok) {
          const errorBody = parsedResponse.data ?? parsedResponse.raw;
          const parsedError = parseApiError(errorBody, response.status);
          
          reportError(
            parsedError.message,
            'api-client',
            response.status >= 500 ? 'error' : 'warning',
            {
              endpoint,
              status: response.status,
              contentType: parsedResponse.contentType,
              bodyPreview: parsedResponse.preview,
            },
          );

          // Check if this is a retryable error (5xx, 408, 429)
          const isRetryable = response.status >= 500 || response.status === 408 || response.status === 429;
          if (isRetryable) {
            const err = new Error(parsedError.message) as any;
            err.status = response.status;
            err.statusCode = response.status;
            throw err;
          }
          
          return {
            success: false,
            error: parsedError.message,
            statusCode: response.status,
            timestamp: new Date().toISOString(),
            parsedError,
          };
        }

        // Get cache headers from response
        const cacheHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          if (key.startsWith('cache-') || key === 'cache-control' || key === 'cdn-cache-control') {
            cacheHeaders[key] = value;
          }
        });

        let result: ApiResponse<T>;
        if (
          parsedResponse.data &&
          typeof parsedResponse.data === 'object' &&
          'success' in (parsedResponse.data as Record<string, unknown>)
        ) {
          result = {
            statusCode: response.status,
            timestamp: new Date().toISOString(),
            cacheHeaders,
            ...(parsedResponse.data as Record<string, unknown>),
          } as ApiResponse<T>;
        } else {
          result = {
            success: true,
            data: parsedResponse.isEmpty ? undefined : (parsedResponse.data as T),
            statusCode: response.status,
            timestamp: new Date().toISOString(),
            cacheHeaders,
          };
        }

        // Cache the response if cacheable
        if (isCacheable && result.success) {
          this.cacheResponse(cacheKey, result, cacheTTL);
        }

        return result;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`[ApiClient] Request to ${endpoint} cancelled`);
          if (cancelOnRouteChange) {
            requestManager.unregisterRequest(requestKey);
          }
          return {
            success: false,
            isCancelled: true,
            error: 'Request cancelled',
            statusCode: 0,
            timestamp: new Date().toISOString(),
          };
        }
        
        const parsedError = parseApiError(error, error?.status ?? error?.statusCode);
        
        // Check if this is a retryable network error
        if (isRetryableError(error, 0)) {
          throw error; // Let retry logic handle it
        }
        
        // If offline and queueOffline is enabled, queue the request
        if (isMutation && options?.queueOffline && typeof navigator !== 'undefined' && !navigator.onLine) {
          const headers = this.buildHeaders(options);
          requestQueue.enqueue({
            url,
            method: options.method || 'GET',
            headers,
            body: options?.body as string,
            maxRetries: 3,
          });
          
          return {
            success: false,
            error: 'You are offline. This request has been queued and will be retried when you reconnect.',
            statusCode: 0,
            timestamp: new Date().toISOString(),
            parsedError: {
              message: 'You are offline. This request has been queued and will be retried when you reconnect.',
              code: ErrorCode.NETWORK_ERROR,
              statusCode: 0,
            },
          };
        }
        
        reportError(error, 'api-client', 'error', { endpoint, message: parsedError.message });

        return {
          success: false,
          error: parsedError.message,
          statusCode: error?.statusCode ?? error?.status ?? parsedError.statusCode,
          timestamp: new Date().toISOString(),
          parsedError,
        };
      }
    };

    // Apply retry logic if retry options are provided
    if (options?.retry) {
      try {
        return await withRetry(executeRequest, {
          ...options.retry,
          onRetry: (attempt, error) => {
            console.log(`Retrying request to ${endpoint} (attempt ${attempt})...`);
            options.retry?.onRetry?.(attempt, error);
          },
        });
      } catch (error) {
        const parsedError = parseApiError(error);
        reportError(error, 'api-client', 'error', { endpoint, message: parsedError.message, retried: true });
        return {
          success: false,
          error: parsedError.message,
          timestamp: new Date().toISOString(),
          parsedError,
        };
      }
    }

    return executeRequest();
  }

  /**
   * GET request with caching
   */
  async get<T>(
    endpoint: string,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'GET',
      cacheResponse: options?.cacheResponse !== false,
    });
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: any,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    body?: any,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: any,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.responseCache.clear();
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidateCache(endpoint: string, method: string = 'GET'): void {
    const cacheKey = `${method}:${this.baseUrl}${endpoint}`;
    this.responseCache.delete(cacheKey);
  }
}

export const apiClient = new ApiClient();
export default ApiClient;