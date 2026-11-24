'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { requestUnsavedChangesNavigation } from '@/lib/forms/unsavedChangesNavigation';

export function useGuardedRouter() {
  const router = useRouter();

  return useMemo(
    () => ({
      push: (...args: Parameters<typeof router.push>) =>
        requestUnsavedChangesNavigation(() => router.push(...args)),
      replace: (...args: Parameters<typeof router.replace>) =>
        requestUnsavedChangesNavigation(() => router.replace(...args)),
      back: () => requestUnsavedChangesNavigation(() => router.back()),
    }),
    [router],
  );
}
