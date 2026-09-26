/**
 * Utility functions for hydration-safe operations
 */

/**
 * Safe localStorage access that only runs on the client
 */
export function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Safe sessionStorage access that only runs on the client
 */
export function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Check if code is running on the client
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if code is running on the server
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Safely read a value from localStorage with a fallback
 */
export function safeGetItem(key: string, fallback: string | null = null): string | null {
  if (isClient()) {
    try {
      const storage = safeLocalStorage();
      if (storage) {
        return storage.getItem(key);
      }
    } catch {
      // Ignore errors
    }
  }
  return fallback;
}

/**
 * Safely set a value in localStorage
 */
export function safeSetItem(key: string, value: string): boolean {
  if (isClient()) {
    try {
      const storage = safeLocalStorage();
      if (storage) {
        storage.setItem(key, value);
        return true;
      }
    } catch {
      // Ignore errors
    }
  }
  return false;
}

/**
 * Safely remove a value from localStorage
 */
export function safeRemoveItem(key: string): boolean {
  if (isClient()) {
    try {
      const storage = safeLocalStorage();
      if (storage) {
        storage.removeItem(key);
        return true;
      }
    } catch {
      // Ignore errors
    }
  }
  return false;
}