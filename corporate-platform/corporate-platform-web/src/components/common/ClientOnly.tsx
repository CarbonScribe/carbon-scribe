'use client';

import { ReactNode } from 'react';
import { useHydrated } from '@/hooks/useHydrated';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that only renders its children on the client.
 * Prevents hydration mismatches for client-only content.
 * 
 * @param {ClientOnlyProps} props - The component props
 * @param {ReactNode} props.children - Content to render on client
 * @param {ReactNode} props.fallback - Content to render on server (optional)
 * 
 * @example
 * <ClientOnly fallback={<Skeleton />}>
 *   <ClientComponent />
 * </ClientOnly>
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isHydrated = useHydrated();
  return isHydrated ? <>{children}</> : <>{fallback}</>;
}