import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  registerUnsavedChanges,
  unregisterUnsavedChanges,
  hasUnsavedChanges,
  clearAllUnsavedChanges,
  useHasUnsavedChanges,
  useUnsavedChangesRegistration,
} from './unsavedChangesRegistry';

describe('unsavedChangesRegistry', () => {
  afterEach(() => {
    clearAllUnsavedChanges();
  });

  it('reports no unsaved changes by default', () => {
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('reports unsaved changes once a form registers', () => {
    registerUnsavedChanges('form-a');
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('clears once the only registered form unregisters', () => {
    registerUnsavedChanges('form-a');
    unregisterUnsavedChanges('form-a');
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('stays dirty while any of multiple registered forms remains dirty', () => {
    registerUnsavedChanges('form-a');
    registerUnsavedChanges('form-b');
    unregisterUnsavedChanges('form-a');
    expect(hasUnsavedChanges()).toBe(true);
    unregisterUnsavedChanges('form-b');
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('clearAllUnsavedChanges clears every registered form at once', () => {
    registerUnsavedChanges('form-a');
    registerUnsavedChanges('form-b');
    clearAllUnsavedChanges();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('useHasUnsavedChanges reacts to registrations made outside the hook', () => {
    const { result } = renderHook(() => useHasUnsavedChanges());
    expect(result.current).toBe(false);

    act(() => registerUnsavedChanges('form-a'));
    expect(result.current).toBe(true);

    act(() => unregisterUnsavedChanges('form-a'));
    expect(result.current).toBe(false);
  });

  it('useUnsavedChangesRegistration registers while isDirty is true and unregisters on cleanup', () => {
    const { result, rerender, unmount } = renderHook(
      ({ isDirty }: { isDirty: boolean }) => {
        useUnsavedChangesRegistration('compliance-form', isDirty);
        return useHasUnsavedChanges();
      },
      { initialProps: { isDirty: false } },
    );

    expect(result.current).toBe(false);

    rerender({ isDirty: true });
    expect(result.current).toBe(true);
    expect(hasUnsavedChanges()).toBe(true);

    rerender({ isDirty: false });
    expect(result.current).toBe(false);

    rerender({ isDirty: true });
    expect(hasUnsavedChanges()).toBe(true);

    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });
});
