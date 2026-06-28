'use client';

import { useRouteChangeCancellation } from '@/hooks/useRouteChangeCancellation';

export function RouteCancellationProvider({ children }: { children: React.ReactNode }) {
  useRouteChangeCancellation();
  return <>{children}</>;
}
