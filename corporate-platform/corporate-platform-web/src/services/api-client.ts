import { getAccessToken } from '@/lib/auth/token-storage';
import { parseApiError, ParsedError, ErrorCode } from '@/lib/utils/errorParser';
import { withRetry, isRetryableError, RetryOptions, generateIdempotencyKey } from '@/lib/utils/retry';
import { requestQueue } from '@/lib/utils/requestQueue';
import { reportError } from '@/lib/telemetry/errorReporter';
import { requestManager } from '@/lib/api/requestManager';

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
}

export interface ApiFetchOptions extends RequestInit {
  timeout?: number;
  retry?: RetryOptions;
  idempotencyKey?: string;
  queueOffline?: boolean; // Whether to queue request when offline
  signal?: AbortSignal;
  cancelOnRouteChange?: boolean;
  deduplicate?: boolean;
}

class ApiClient {
  private baseUrl: string;

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

    return headers;
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

        const data = await response.json();

        if (!response.ok) {
          const parsedError = parseApiError(data, response.status);
          
          // Check if this is a retryable error (5xx, 408, 429)
          const isRetryable = response.status >= 500 || response.status === 408 || response.status === 429;
          if (isRetryable) {
            throw new Error(parsedError.message);
          }
          
          return {
            success: false,
            error: parsedError.message,
            statusCode: response.status,
            timestamp: new Date().toISOString(),
            parsedError,
          };
        }

        return data as ApiResponse<T>;
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
        
        const parsedError = parseApiError(error);
        
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
   * GET request
   */
  async get<T>(
    endpoint: string,
    options?: ApiFetchOptions,
  ): Promise<ApiResponse<T>> {
    return this.fetch<T>(endpoint, { ...options, method: 'GET' });
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
}

export const apiClient = new ApiClient();
export default ApiClient;
