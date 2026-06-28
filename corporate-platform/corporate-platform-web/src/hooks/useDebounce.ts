'use client';

import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * inactivity. Useful for preventing rapid filter changes from issuing a new
 * API request on every individual keystroke or checkbox click.
 *
 * The returned value is initialised synchronously to `value` (no delay on
 * first render), so the first API call is never blocked.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
