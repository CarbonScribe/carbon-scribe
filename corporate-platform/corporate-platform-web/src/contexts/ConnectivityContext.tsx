'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ConnectionStatus = 'online' | 'degraded' | 'offline';

export interface ConnectivityState {
  status: ConnectionStatus;
  isOnline: boolean;
  lastOnlineTime: number | null;
  lastSuccessfulApiCall: number | null;
  pendingOperations: number;
  consecutiveFailures: number;
}

interface ConnectivityContextValue {
  state: ConnectivityState;
  updateStatus: (status: ConnectionStatus) => void;
  recordApiCall: (success: boolean) => void;
  incrementPendingOperations: () => void;
  decrementPendingOperations: () => void;
  retryPendingOperations: () => Promise<{ success: number; failed: number }>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

const DEGRADED_THRESHOLD = Number(process.env.NEXT_PUBLIC_DEGRADED_THRESHOLD) || 3; // Number of consecutive failures to trigger degraded state
const DEGRADED_RECOVERY_THRESHOLD = Number(process.env.NEXT_PUBLIC_DEGRADED_RECOVERY_THRESHOLD) || 2; // Number of consecutive successes to recover from degraded
const CONNECTIVITY_CHECK_INTERVAL = Number(process.env.NEXT_PUBLIC_CONNECTIVITY_CHECK_INTERVAL) || 30000; // Connectivity check interval in milliseconds

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  // Get initial online status from navigator, default to true if not available
  const getInitialOnlineStatus = (): boolean => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  };

  const [state, setState] = useState<ConnectivityState>(() => ({
    status: getInitialOnlineStatus() ? 'online' : 'offline',
    isOnline: getInitialOnlineStatus(),
    lastOnlineTime: Date.now(),
    lastSuccessfulApiCall: Date.now(),
    pendingOperations: 0,
    consecutiveFailures: 0,
  }));

  // Monitor browser online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
        lastOnlineTime: Date.now(),
        status: 'online',
      }));
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
        status: 'offline',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic connectivity check (ping) - only runs in browser
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkConnectivity = async () => {
      try {
        // Simple fetch to check connectivity
        const response = await fetch(window.location.href, { 
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          recordApiCall(true);
        } else {
          recordApiCall(false);
        }
      } catch (error) {
        recordApiCall(false);
      }
    };

    const interval = setInterval(checkConnectivity, CONNECTIVITY_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const updateStatus = (status: ConnectionStatus) => {
    setState((prev) => ({ ...prev, status }));
  };

  const recordApiCall = (success: boolean) => {
    setState((prev) => {
      const newConsecutiveFailures = success ? 0 : prev.consecutiveFailures + 1;
      
      // Determine status based on consecutive failures
      let newStatus: ConnectionStatus = prev.status;
      
      if (!prev.isOnline) {
        newStatus = 'offline';
      } else if (newConsecutiveFailures >= DEGRADED_THRESHOLD) {
        newStatus = 'degraded';
      } else if (success && prev.status === 'degraded' && newConsecutiveFailures === 0) {
        // Only recover after reaching 0 consecutive failures (successful call)
        newStatus = 'online';
      } else if (success && prev.status === 'offline') {
        newStatus = 'online';
      }

      return {
        ...prev,
        consecutiveFailures: newConsecutiveFailures,
        status: newStatus,
        lastSuccessfulApiCall: success ? Date.now() : prev.lastSuccessfulApiCall,
      };
    });
  };

  const incrementPendingOperations = () => {
    setState((prev) => ({
      ...prev,
      pendingOperations: prev.pendingOperations + 1,
    }));
  };

  const decrementPendingOperations = () => {
    setState((prev) => ({
      ...prev,
      pendingOperations: Math.max(0, prev.pendingOperations - 1),
    }));
  };

  const retryPendingOperations = async () => {
    // Import request queue dynamically to avoid circular dependency
    const { requestQueue } = await import('@/lib/utils/requestQueue');
    
    const { success, failed } = await requestQueue.processQueue(async (url, options) => {
      return fetch(url, options);
    });
    
    setState((prev) => ({
      ...prev,
      status: 'online',
      pendingOperations: Math.max(0, prev.pendingOperations - success - failed),
    }));
    
    return { success, failed };
  };

  const value: ConnectivityContextValue = {
    state,
    updateStatus,
    recordApiCall,
    incrementPendingOperations,
    decrementPendingOperations,
    retryPendingOperations,
  };

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextValue {
  const context = useContext(ConnectivityContext);
  if (context === undefined) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
}
