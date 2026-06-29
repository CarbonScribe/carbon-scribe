'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { requestManager } from '@/lib/api/requestManager';

/**
 * Hook to automatically cancel in-flight API requests when the user navigates 
 * between routes. This prevents stale data from updating unmounted components
 * and reduces unnecessary network traffic.
 */
export function useRouteChangeCancellation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Only cancel requests if the actual pathname changed (not just query params)
    if (previousPathname.current !== pathname) {
      requestManager.cancelAllRequests();
      previousPathname.current = pathname;
    }
  }, [pathname, searchParams]);
}
