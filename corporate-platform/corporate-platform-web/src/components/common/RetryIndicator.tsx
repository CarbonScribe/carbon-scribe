'use client';

import { Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RetryIndicatorProps {
  isRetrying: boolean;
  attempt?: number;
  maxAttempts?: number;
  message?: string;
}

/**
 * Retry status indicator component
 * Shows visual feedback during retry attempts
 */
export default function RetryIndicator({
  isRetrying,
  attempt = 1,
  maxAttempts = 3,
  message = 'Retrying...',
}: RetryIndicatorProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isRetrying) {
      setDots('');
      return;
    }

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, [isRetrying]);

  if (!isRetrying) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <Loader2 size={16} className="animate-spin text-corporate-blue" />
      <span>
        {message} {dots} ({attempt}/{maxAttempts})
      </span>
    </div>
  );
}

/**
 * Retry toast notification for displaying retry status
 */
export function RetryToast({
  isRetrying,
  attempt,
  maxAttempts,
  error,
}: {
  isRetrying: boolean;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
}) {
  if (!isRetrying) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in">
      <Loader2 size={20} className="animate-spin text-corporate-blue mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-white text-sm">
          Retrying request...
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Attempt {attempt} of {maxAttempts}
        </p>
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
