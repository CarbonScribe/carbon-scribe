import { toast } from 'sonner';
import type { ActionableError } from '@/lib/utils/errorHandler';

/**
 * Enhanced Toast Notification System
 * 
 * Provides consistent toast notifications with actionable feedback,
 * retry options, and proper error handling across the application.
 */

export type ToastDuration = 'short' | 'medium' | 'long' | 'persistent';

const DURATION_MAP = {
  short: 3000,
  medium: 5000,
  long: 8000,
  persistent: Infinity,
};

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: ToastDuration;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  id?: string;
}

/**
 * Show a success toast
 */
export function showSuccessToast(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  toast.success(message, {
    duration: DURATION_MAP[options?.duration || 'short'],
    description: options?.description,
    action: options?.action,
    cancel: options?.cancel,
    id: options?.id,
  });
}

/**
 * Show an error toast with actionable feedback
 */
export function showErrorToast(
  message: string,
  options?: Omit<ToastOptions, 'title'> & {
    error?: unknown;
    onRetry?: () => void;
    retryable?: boolean;
  }
) {
  const action = options?.onRetry
    ? {
        label: 'Retry',
        onClick: options.onRetry,
      }
    : options?.action;

  toast.error(message, {
    duration: DURATION_MAP[options?.duration || 'long'],
    description: options?.description,
    action,
    cancel: options?.cancel,
    id: options?.id,
  });
}

/**
 * Show an info toast
 */
export function showInfoToast(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  toast.info(message, {
    duration: DURATION_MAP[options?.duration || 'medium'],
    description: options?.description,
    action: options?.action,
    cancel: options?.cancel,
    id: options?.id,
  });
}

/**
 * Show a warning toast
 */
export function showWarningToast(
  message: string,
  options?: Omit<ToastOptions, 'title'>
) {
  toast.warning(message, {
    duration: DURATION_MAP[options?.duration || 'medium'],
    description: options?.description,
    action: options?.action,
    cancel: options?.cancel,
    id: options?.id,
  });
}

/**
 * Show a loading toast (returns toast ID for dismissal)
 */
export function showLoadingToast(message: string): string | number {
  return toast.loading(message, {
    duration: DURATION_MAP.persistent,
  });
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(id: string | number) {
  toast.dismiss(id);
}

/**
 * Handle API mutation with automatic toast notifications
 * 
 * @param mutationFn - The async function to execute
 * @param options - Configuration for success/error messages and callbacks
 * @returns The result of the mutation or null if it failed
 */
export async function withMutationToast<T>(
  mutationFn: () => Promise<T>,
  options: {
    loadingMessage?: string;
    successMessage: string;
    errorMessage?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: unknown) => void;
    retryable?: boolean;
    onRetry?: () => void;
  }
): Promise<T | null> {
  const {
    loadingMessage,
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    retryable = true,
    onRetry,
  } = options;

  // Show loading toast if message provided
  const loadingId = loadingMessage ? showLoadingToast(loadingMessage) : null;

  try {
    const result = await mutationFn();

    // Dismiss loading toast
    if (loadingId) dismissToast(loadingId);

    // Show success toast
    showSuccessToast(successMessage);

    // Call success callback
    onSuccess?.(result);

    return result;
  } catch (error) {
    // Dismiss loading toast
    if (loadingId) dismissToast(loadingId);

    // Extract error message
    const message = errorMessage || extractUserMessage(error);

    // Show error toast
    showErrorToast(message, {
      description: getErrorDescription(error),
      onRetry: retryable && onRetry ? onRetry : undefined,
      retryable,
    });

    // Call error callback
    onError?.(error);

    return null;
  }
}

/**
 * Extract user-friendly message from error object
 */
function extractUserMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) {
    const apiError = error as any;
    return apiError.response?.data?.message || 
           apiError.response?.data?.error || 
           error.message || 
           'An unexpected error occurred';
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    return errObj.message || errObj.error || 'An unexpected error occurred';
  }

  return 'An unexpected error occurred';
}

/**
 * Get additional error description for troubleshooting
 */
function getErrorDescription(error: unknown): string | undefined {
  if (error instanceof Error) {
    const apiError = error as any;
    const status = apiError.response?.status;
    
    if (status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (status === 403) {
      return 'You don\'t have permission to perform this action.';
    }
    if (status === 404) {
      return 'The requested resource was not found.';
    }
    if (status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (status && status >= 500) {
      return 'A server error occurred. Please try again in a moment.';
    }
  }

  return undefined;
}

/**
 * Wrapper for async operations with error handling
 * Useful for non-mutation operations that still need error feedback
 */
export async function withErrorHandling<T>(
  operationFn: () => Promise<T>,
  options: {
    errorMessage?: string;
    onError?: (error: unknown) => void;
  }
): Promise<T | null> {
  try {
    return await operationFn();
  } catch (error) {
    const message = options.errorMessage || extractUserMessage(error);
    
    showErrorToast(message, {
      description: getErrorDescription(error),
    });

    options.onError?.(error);
    return null;
  }
}
