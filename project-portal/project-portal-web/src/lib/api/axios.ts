import { showErrorToast } from "@/lib/utils/toast";
import axios, { AxiosError } from "axios";

const RAW_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8080";

export const API_BASE_URL = RAW_API_BASE_URL.endsWith("/api/v1")
  ? RAW_API_BASE_URL
  : `${RAW_API_BASE_URL}/api/v1`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20_000,
});

// Dynamically import the Zustand store to avoid circular imports
let getUserId: (() => string | null) | null = null;
export function setUserIdGetter(fn: () => string | null) {
  getUserId = fn;
}

// Attach X-User-ID header for financing endpoints if user is authenticated
api.interceptors.request.use((config) => {
  if (getUserId && config.url && config.url.includes('/financing/')) {
    const userId = getUserId();
    if (userId) {
      if (typeof window !== 'undefined') {
        console.debug('[DEBUG] X-User-ID header value:', userId);
        try {
          localStorage.setItem('last-x-user-id', userId);
        } catch {}
      }
      config.headers = config.headers || {};
      config.headers['X-User-ID'] = userId;
    } else {
      if (typeof window !== 'undefined') {
        console.warn('[DEBUG] No userId found for X-User-ID header');
        try {
          localStorage.setItem('last-x-user-id', '');
        } catch {}
      }
    }
  }
  return config;
});

// Token setter (store calls this)
export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

// 401 handler (store can inject behavior)
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

// Track shown errors to prevent duplicate toasts
const shownErrors = new Set<string>();
const ERROR_COOLDOWN = 5000; // 5 seconds

// Track if refresh is already in progress
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const originalRequest = err.config as any;
    
    if (status === 401 && onUnauthorized && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
      
      isRefreshing = true;
      
      try {
        // Attempt to refresh session
        const { useStore } = await import("@/lib/store/store");
        const state = useStore.getState();
        
        await state.refreshSession();
        
        const newToken = state.token;
        if (newToken) {
          // Update auth header
          setAuthToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          // Notify queued subscribers
          onRefreshed(newToken);
          isRefreshing = false;
          
          // Retry original request
          return api(originalRequest);
        }
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshed(''); // Clear subscribers
        // Refresh failed - show toast and logout
        showErrorToast("Session expired", {
          description: "Please sign in again to continue.",
        });
        onUnauthorized();
      }
      
      return Promise.reject(err);
    }
    
    // Prevent duplicate error toasts within cooldown period (for non-401 errors)
    const errorMessage = (err.response?.data as any)?.message || err.message;
    const errorKey = `${status}-${errorMessage}`;
    const shouldShowToast = !shownErrors.has(errorKey);
    
    if (shouldShowToast && status !== 401) {
      shownErrors.add(errorKey);
      setTimeout(() => shownErrors.delete(errorKey), ERROR_COOLDOWN);

      // Don't show toast for expected errors (forbidden, not found)
      if (status !== 403 && status !== 404) {
        showErrorToast(errorMessage, {
          description: getErrorDescription(status),
          retryable: isRetryableStatus(status),
        });
      }
    }
    
    return Promise.reject(err);
  },
);

/**
 * Get user-friendly error description based on status code
 */
function getErrorDescription(status?: number): string | undefined {
  switch (status) {
    case 400:
      return "Please check your input and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "This conflicts with existing data. Please refresh and try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "A server error occurred. Please try again in a moment.";
    case 502:
      return "The server is temporarily unavailable. Please try again later.";
    case 503:
      return "Service is temporarily unavailable. Please try again later.";
    case 504:
      return "The request timed out. Please try again.";
    default:
      if (status && status >= 500) {
        return "A server error occurred. Please try again.";
      }
      return undefined;
  }
}

/**
 * Check if the error is retryable based on status code
 */
function isRetryableStatus(status?: number): boolean {
  return status ? [408, 429, 500, 502, 503, 504].includes(status) : true;
}
