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

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status;
    const errorMessage = (err.response?.data as any)?.message || err.message;
    const errorKey = `${status}-${errorMessage}`;

    // Prevent duplicate error toasts within cooldown period
    const shouldShowToast = !shownErrors.has(errorKey);
    
    if (shouldShowToast) {
      shownErrors.add(errorKey);
      setTimeout(() => shownErrors.delete(errorKey), ERROR_COOLDOWN);

      // Handle 401 separately
      if (status === 401) {
        if (onUnauthorized) {
          showErrorToast("Session expired", {
            description: "Please sign in again to continue.",
          });
          onUnauthorized();
        }
      } else if (status !== 403 && status !== 404) {
        // Don't show toast for expected errors (forbidden, not found)
        // These should be handled by the calling code
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
