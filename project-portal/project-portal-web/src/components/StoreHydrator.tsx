'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/store';
import { showErrorToast } from '@/lib/utils/toast';

export default function StoreHydrator() {
  const isHydrated = useStore((s) => s.isHydrated);
  const setHydrated = useStore((s) => s.setHydrated);

  useEffect(() => {
    if (!isHydrated) {
      setHydrated(true);
    }
  }, [isHydrated, setHydrated]);

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event.reason;
      const status: number | undefined =
        reason?.response?.status ??
        reason?.status ??
        reason?.statusCode ??
        reason?.cause?.status;

      if (status && status >= 500 && status <= 599) {
        showErrorToast('CarbonScribe is having trouble', {
          description: 'A server error occurred. Please try again in a moment.',
          retryable: true,
          id: 'global-5xx',
        });
        event.preventDefault();
      }
    };

    const onError = (event: ErrorEvent) => {
      const error: any = event.error;
      const status: number | undefined =
        error?.response?.status ??
        error?.status ??
        error?.statusCode ??
        error?.cause?.status;

      if (status && status >= 500 && status <= 599) {
        showErrorToast('CarbonScribe is having trouble', {
          description: 'A server error occurred. Please try again in a moment.',
          retryable: true,
          id: 'global-5xx',
        });
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
