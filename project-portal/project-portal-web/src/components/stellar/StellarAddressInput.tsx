'use client';

import { forwardRef, useId, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react';
import { validateStellarAddress } from '@/lib/stellar/address';

export interface StellarAddressInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'id'> {
  value: string;
  onChange: (value: string) => void;
  /** Called with the validation outcome on every change. */
  onValidChange?: (valid: boolean, normalized: string) => void;
  label?: string;
  /** Whether an empty value is itself an error. Defaults to true. */
  required?: boolean;
  id?: string;
  containerClassName?: string;
}

/**
 * A reusable Stellar wallet/address text input (#803) with inline
 * validation: shows a specific error (missing "G" prefix, wrong length, or
 * a failed checksum) once the field is touched, using the same shared
 * `validateStellarAddress` the rest of the app relies on — so a form never
 * has to re-implement this itself, and can't drift from the backend/wallet
 * login validation.
 */
const StellarAddressInput = forwardRef<HTMLInputElement, StellarAddressInputProps>(
  (
    {
      value,
      onChange,
      onValidChange,
      label = 'Stellar address',
      placeholder = 'G...',
      required = true,
      id,
      containerClassName = '',
      className = '',
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const [touched, setTouched] = useState(false);

    const result = validateStellarAddress(value);
    const isEmpty = value.trim() === '';
    const isValid = !required && isEmpty ? true : result.valid;
    const showError = touched && !isValid;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      onChange(next);
      const nextResult = validateStellarAddress(next);
      const nextIsEmpty = next.trim() === '';
      onValidChange?.(!required && nextIsEmpty ? true : nextResult.valid, nextResult.normalized);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      // Normalize on blur so the field visibly reflects what will actually
      // be submitted (trimmed, upper-cased) rather than silently rewriting
      // it on every keystroke.
      if (result.normalized !== value) {
        onChange(result.normalized);
      }
      onBlur?.(event);
    };

    return (
      <div className={containerClassName}>
        {label && (
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none transition-colors focus:ring-2 ${
            showError
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-100 dark:border-gray-600'
          } ${className}`}
        />
        {showError && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
            {result.errorMessage}
          </p>
        )}
      </div>
    );
  },
);

StellarAddressInput.displayName = 'StellarAddressInput';

export default StellarAddressInput;
