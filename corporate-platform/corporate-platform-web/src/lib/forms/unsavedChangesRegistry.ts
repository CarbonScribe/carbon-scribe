'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Lightweight "dirty form" registry (#549).
 *
 * Any component with in-progress, unsaved user input (a compliance form,
 * a retirement schedule, etc.) can register itself here via
 * `useUnsavedChangesRegistration`. SessionTimeoutModal consults
 * `useHasUnsavedChanges` to decide whether the warning state must become a
 * non-dismissable blocking modal instead of the normal dismissible banner —
 * the goal is to only pay that UX cost when real work is actually at risk
 * of being silently lost to a forced logout.
 *
 * Implemented as a module-level store (not a React Context) so any
 * component can opt in without the app needing to wrap itself in a new
 * provider.
 */

const dirtyForms = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function registerUnsavedChanges(formId: string): void {
  if (dirtyForms.has(formId)) return;
  dirtyForms.add(formId);
  notify();
}

export function unregisterUnsavedChanges(formId: string): void {
  if (!dirtyForms.has(formId)) return;
  dirtyForms.delete(formId);
  notify();
}

export function hasUnsavedChanges(): boolean {
  return dirtyForms.size > 0;
}

/** Clears every registered form — call on logout so a stale dirty flag from
 * one session can't linger into the next login. */
export function clearAllUnsavedChanges(): void {
  if (dirtyForms.size === 0) return;
  dirtyForms.clear();
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): boolean {
  return false;
}

/** Subscribes to whether any registered form currently has unsaved changes. */
export function useHasUnsavedChanges(): boolean {
  return useSyncExternalStore(subscribe, hasUnsavedChanges, getServerSnapshot);
}

/**
 * Registers `formId` as dirty for as long as `isDirty` is true, and
 * unregisters it automatically on cleanup (isDirty flipping to false, or
 * the component unmounting — e.g. navigating away without saving).
 *
 * @example
 * function ComplianceForm() {
 *   const [values, setValues] = useState(initial);
 *   useUnsavedChangesRegistration('compliance-form', !isEqual(values, initial));
 *   ...
 * }
 */
export function useUnsavedChangesRegistration(formId: string, isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    registerUnsavedChanges(formId);
    return () => unregisterUnsavedChanges(formId);
  }, [formId, isDirty]);
}
