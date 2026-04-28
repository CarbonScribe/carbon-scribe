/**
 * Enhanced API Client with Automatic Token Refresh
 * 
 * This client intercepts 401 responses and attempts to refresh the token
 * before retrying the original request.
 */

import { apiRequest, ApiError } from './http';
import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearAuthData,
  isTokenExpired,
} from '@/lib/auth/token-storage';
import { refreshApi } from './auth.api';

interface RequestQueueItem {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

class AuthApiClient {
  private isRefreshing = false;
  private failedQueue: RequestQueueItem[] = [];
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  }

  /**
   * Process the failed request queue
   */
  private processQueue(error: Error | null, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });

    this.failedQueue = [];
  }

  /**
   * Refresh the token
   */
  private async refreshToken(): Promise<string> {
    const refreshToken = getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await refreshApi(refreshToken);
    
    // Store new tokens (access token expires in 15min = 900s)
    storeTokens(response.accessToken, response.refreshToken, 900);
    
    return response.accessToken;
  }

  /**
   * Make an authenticated request with automatic token refresh
   */
  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    let token = getAccessToken();

    // If token is expired, try to refresh it
    if (isTokenExpired(60) && getRefreshToken()) {
      if (this.isRefreshing) {
        // Wait for the ongoing refresh
        return new Promise<T>((resolve, reject) => {
          this.failedQueue.push({
            resolve: (newToken) => {
              const newOptions = {
                ...options,
                headers: {
                  ...options.headers,
                  Authorization: `Bearer ${newToken}`,
                },
              };
              
              apiRequest<T>(path, newOptions, { baseUrl: this.baseUrl })
                .then(resolve)
                .catch(reject);
            },
            reject,
          });
        });
      }

      this.isRefreshing = true;

      try {
        const newToken = await this.refreshToken();
        token = newToken;
        this.processQueue(null, newToken);
      } catch (error) {
        this.processQueue(error as Error, null);
        clearAuthData();
        throw error;
      } finally {
        this.isRefreshing = false;
      }
    }

    // Make the request with the token
    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    try {
      return await apiRequest<T>(path, authOptions, { baseUrl: this.baseUrl });
    } catch (error) {
      // If we get a 401 and haven't already tried refreshing
      if (error instanceof ApiError && error.status === 401 && !this.isRefreshing) {
        this.isRefreshing = true;

        try {
          const newToken = await this.refreshToken();
          
          // Retry the original request with the new token
          const retryOptions = {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newToken}`,
            },
          };
          
          return await apiRequest<T>(path, retryOptions, { baseUrl: this.baseUrl });
        } catch (refreshError) {
          clearAuthData();
          throw refreshError;
        } finally {
          this.isRefreshing = false;
        }
      }

      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const authApiClient = new AuthApiClient();
export default AuthApiClient;
