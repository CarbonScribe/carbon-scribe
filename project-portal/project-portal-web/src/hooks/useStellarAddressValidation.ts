'use client';

import { useCallback, useMemo, useState } from 'react';
import { validateStellarAddress } from '@/lib/stellar/address';

export interface UseStellarAddressValidationOptions {
  /**
   * Whether an empty value is itself an error. Defaults to true — most
   * wallet/address fields are only rendered when an address is expected.
   * Pass false for an optional field where a blank value is acceptable.
   */
  required?: boolean;
}

export interface UseStellarAddressValidationResult {
  value: string;
  setValue: (next: string) => void;
  /** Call on blur so the error only appears after the user leaves the field. */
  markTouched: () => void;
  touched: boolean;
  /** True if the current value is acceptable to submit (honors `required`). */
  isValid: boolean;
  /** Trimmed, upper-cased form of the current value. */
  normalized: string;
  /** Set only once the field has been touched and the value is unacceptable. */
  errorMessage?: string;
}

/**
 * Validation state for a single Stellar address input (#803), built on the
 * shared `validateStellarAddress` — reusable by any wallet/address form
 * field without each one re-implementing touched/blur/error-message logic.
 */
export function useStellarAddressValidation(
  initialValue = '',
  options: UseStellarAddressValidationOptions = {},
): UseStellarAddressValidationResult {
  const { required = true } = options;
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  const result = useMemo(() => validateStellarAddress(value), [value]);
  const isEmpty = value.trim() === '';
  const isValid = !required && isEmpty ? true : result.valid;

  const markTouched = useCallback(() => setTouched(true), []);

  return {
    value,
    setValue,
    markTouched,
    touched,
    isValid,
    normalized: result.normalized,
    errorMessage: touched && !isValid ? result.errorMessage : undefined,
  };
}
