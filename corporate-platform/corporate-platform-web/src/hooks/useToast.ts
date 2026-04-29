/**
 * Toast notification hook and utilities
 * Provides simple toast notifications for user feedback
 */

"use client";

import { useState, useEffect, useCallback } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds, 0 = indefinite
}

// Global toast state (simple implementation)
// In production, consider using a state management solution like Zustand
let toastListeners: ((toast: Toast) => void)[] = [];
let toastRemoveListeners: ((id: string) => void)[] = [];
let toastIdCounter = 0;

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = "info",
  duration = 5000,
): string {
  const id = `toast-${++toastIdCounter}`;
  const toast: Toast = { id, message, type, duration };

  toastListeners.forEach((listener) => listener(toast));

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

/**
 * Remove a toast notification
 */
export function removeToast(id: string): void {
  toastRemoveListeners.forEach((listener) => listener(id));
}

/**
 * Subscribe to toast changes
 */
function onToastAdded(callback: (toast: Toast) => void): () => void {
  toastListeners.push(callback);
  return () => {
    toastListeners = toastListeners.filter((l) => l !== callback);
  };
}

/**
 * Subscribe to toast removals
 */
function onToastRemoved(callback: (id: string) => void): () => void {
  toastRemoveListeners.push(callback);
  return () => {
    toastRemoveListeners = toastRemoveListeners.filter((l) => l !== callback);
  };
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
  const success = useCallback((message: string, duration?: number) => {
    return showToast(message, "success", duration);
  }, []);

  const error = useCallback((message: string, duration?: number) => {
    return showToast(message, "error", duration);
  }, []);

  const warning = useCallback((message: string, duration?: number) => {
    return showToast(message, "warning", duration);
  }, []);

  const info = useCallback((message: string, duration?: number) => {
    return showToast(message, "info", duration);
  }, []);

  const remove = useCallback((id: string) => {
    removeToast(id);
  }, []);

  return { success, error, warning, info, remove };
}

/**
 * Hook to listen to toast changes (for implementing ToastContainer)
 */
export function useToastListener() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribeAdd = onToastAdded((toast: Toast) => {
      setToasts((prev: Toast[]) => [...prev, toast]);
    });

    const unsubscribeRemove = onToastRemoved((id: string) => {
      setToasts((prev: Toast[]) => prev.filter((t) => t.id !== id));
    });

    return () => {
      unsubscribeAdd();
      unsubscribeRemove();
    };
  }, []);

  return toasts;
}

/**
 * Convenience functions
 */
export const toast = {
  success: (message: string, duration?: number) =>
    showToast(message, "success", duration),
  error: (message: string, duration?: number) =>
    showToast(message, "error", duration),
  warning: (message: string, duration?: number) =>
    showToast(message, "warning", duration),
  info: (message: string, duration?: number) =>
    showToast(message, "info", duration),
  remove: removeToast,
};

export default useToast;
