'use client';

import { useEffect, useState } from 'react';

/**
 * Hook that returns true only after the component has mounted on the client.
 * Use this to prevent hydration mismatches for client-only content.
 * 
 * @returns {boolean} - True if the component has mounted on the client
 * 
 * @example
 * const isHydrated = useHydrated();
 * return isHydrated ? <ClientComponent /> : <ServerFallback />;
 */
export function useHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}