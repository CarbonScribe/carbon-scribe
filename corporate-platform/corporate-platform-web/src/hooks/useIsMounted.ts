'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook that returns true after the component has mounted on the client.
 * Similar to useHydrated but uses a ref to avoid re-renders.
 * 
 * @returns {boolean} - True if the component has mounted on the client
 * 
 * @example
 * const isMounted = useIsMounted();
 * if (!isMounted) return null;
 * return <ClientOnlyContent />;
 */
export function useIsMounted(): boolean {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted.current;
}