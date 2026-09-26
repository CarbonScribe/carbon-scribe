'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { AccessibleIcon } from '@/components/common/AccessibleIcon';
import { IconButton } from '@/components/common/IconButton';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  backHref?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
}

export default function AccessDenied({
  title = 'Access Denied',
  message = 'You do not have sufficient permissions to access this page.',
  backHref = '/',
  showHomeButton = true,
  showBackButton = true,
}: AccessDeniedProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div 
      className="min-h-[60vh] flex items-center justify-center p-4"
      role="alert"
      aria-live="assertive"
      aria-label="Access denied"
    >
      <div className="max-w-lg w-full corporate-card p-8 text-center">
        {/* Icon */}
        <div 
          className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4"
          aria-hidden="true"
        >
          <ShieldAlert 
            className="text-red-600 dark:text-red-400" 
            size={28}
            aria-hidden="true"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
          <span className="sr-only"> - Access denied</span>
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label="Go back to previous page"
            >
              <AccessibleIcon hidden aria-hidden="true">
                <ArrowLeft size={18} />
              </AccessibleIcon>
              <span>Go Back</span>
            </button>
          )}

          {showHomeButton && (
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-corporate-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-corporate-blue/90"
              aria-label="Return to home page"
            >
              <AccessibleIcon hidden aria-hidden="true">
                <Home size={18} />
              </AccessibleIcon>
              <span>Return Home</span>
            </Link>
          )}
        </div>

        {/* Help text */}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
          If you believe this is an error, please contact your administrator.
        </p>
      </div>
    </div>
  );
}