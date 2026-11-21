import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStellarAddressValidation } from './useStellarAddressValidation';

const VALID_ADDRESS = 'GCUARJVWFF6OZP2SWL2JOLTFMNLMJDEAISPRPBTVSMELNTLLCXR6F5ZQ';

describe('useStellarAddressValidation (#803)', () => {
  it('starts untouched with no error message even if the initial value is invalid', () => {
    const { result } = renderHook(() => useStellarAddressValidation('not-an-address'));
    expect(result.current.isValid).toBe(false);
    expect(result.current.errorMessage).toBeUndefined();
  });

  it('shows an error only after markTouched is called', () => {
    const { result } = renderHook(() => useStellarAddressValidation('not-an-address'));

    act(() => {
      result.current.markTouched();
    });

    expect(result.current.errorMessage).toBeDefined();
  });

  it('is valid for a correct address', () => {
    const { result } = renderHook(() => useStellarAddressValidation(VALID_ADDRESS));
    expect(result.current.isValid).toBe(true);
    expect(result.current.normalized).toBe(VALID_ADDRESS);
  });

  it('treats an empty value as valid when required is false', () => {
    const { result } = renderHook(() =>
      useStellarAddressValidation('', { required: false }),
    );

    act(() => {
      result.current.markTouched();
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errorMessage).toBeUndefined();
  });

  it('treats an empty value as invalid when required (the default)', () => {
    const { result } = renderHook(() => useStellarAddressValidation(''));

    act(() => {
      result.current.markTouched();
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errorMessage).toBeDefined();
  });

  it('re-validates as setValue is called', () => {
    const { result } = renderHook(() => useStellarAddressValidation(''));

    act(() => {
      result.current.setValue(VALID_ADDRESS);
    });

    expect(result.current.isValid).toBe(true);
  });
});
