"use client";

import { useState, useCallback, useRef } from "react";
import {
  SettingsError,
  AuthError,
  ValidationError,
  NotFoundError,
  RateLimitError,
} from "@/lib/api/settings/types";

interface UseSettingsOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: SettingsError) => void;
  showErrorToast?: (message: string) => void;
}

interface UseSettingsState<T> {
  data: T | null;
  isLoading: boolean;
  error: SettingsError | null;
}

export function useSettings<T>(options: UseSettingsOptions<T> = {}) {
  const [state, setState] = useState<UseSettingsState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (asyncFn: () => Promise<T>) => {
      abortControllerRef.current = new AbortController();
      setState({ data: null, isLoading: true, error: null });

      try {
        const data = await asyncFn();
        setState({ data, isLoading: false, error: null });
        options.onSuccess?.(data);
        return data;
      } catch (err) {
        const error = err instanceof SettingsError
          ? err
          : new SettingsError(500, "An unexpected error occurred");

        setState({ data: null, isLoading: false, error });
        options.onError?.(error);

        // Handle specific error types
        if (error instanceof AuthError) {
          options.showErrorToast?.(error.message);
        } else if (error instanceof ValidationError) {
          const errorMessages = Object.entries(error.errors)
            .map(([key, messages]) => `${key}: ${messages.join(", ")}`)
            .join("; ");
          options.showErrorToast?.(errorMessages);
        } else if (error instanceof RateLimitError) {
          options.showErrorToast?.(
            `Too many requests. Try again in ${error.retryAfter} seconds.`
          );
        } else if (error instanceof NotFoundError) {
          options.showErrorToast?.(error.message);
        } else {
          options.showErrorToast?.(error.message);
        }

        throw error;
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specialized hooks for different settings sections
export function useProfileSettings() {
  return useSettings<any>();
}

export function useNotificationSettings() {
  return useSettings<any>();
}

export function useAPIKeySettings() {
  return useSettings<any>();
}

export function useIntegrationSettings() {
  return useSettings<any>();
}

export function useBillingSettings() {
  return useSettings<any>();
}
