'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { ParsedError, formatFieldErrors, hasFieldErrors } from '@/lib/utils/errorParser';

interface ErrorDisplayProps {
  error: string | ParsedError | null;
  onRetry?: () => void;
  showFieldErrors?: boolean;
  className?: string;
}

/**
 * Reusable error display component that handles both simple error strings
 * and parsed error objects with field-level validation errors.
 */
export default function ErrorDisplay({
  error,
  onRetry,
  showFieldErrors = true,
  className = '',
}: ErrorDisplayProps) {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const fieldErrors = typeof error === 'object' && hasFieldErrors(error) ? error.fieldErrors : null;

  return (
    <div className={`corporate-card p-6 text-center ${className}`}>
      <AlertCircle className="mx-auto mb-3 text-red-500" size={32} />
      
      {/* Main error message */}
      <p className="text-gray-700 dark:text-gray-300 mb-4">{errorMessage}</p>
      
      {/* Field-level validation errors */}
      {showFieldErrors && fieldErrors && Object.keys(fieldErrors).length > 0 && (
        <div className="mb-4 text-left">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Please fix the following issues:
          </p>
          <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
            {formatFieldErrors(fieldErrors).map((fieldError, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                {fieldError}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="corporate-btn-primary px-4 py-2 text-sm inline-flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  );
}
