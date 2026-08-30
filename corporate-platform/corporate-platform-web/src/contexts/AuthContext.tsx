'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type {
  AuthPermission,
  AuthRole,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from '@/types/auth.types';
import {
  loginApi,
  registerApi,
  refreshApi,
  logoutApi,
  getProfileApi,
} from '@/lib/api/auth.api';
import {
  canAccessRoute as canAccessRouteByRole,
  getPermissionsForRole,
  normalizeRole,
} from '@/lib/auth/rbac';
import {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  clearAuthData,
  storeUser,
  getUser,
  hasRefreshToken,
  getTokenExpiry,
} from '@/lib/auth/token-storage';
import { reportError } from '@/lib/telemetry/errorReporter';
import { useHydrated } from '@/hooks/useHydrated';
import { isClient, safeGetItem, safeSetItem, safeRemoveItem } from '@/lib/utils/hydration';
import {
  broadcastAuthEvent,
  createAuthChannel,
  isAuthStorageKey,
  tryAcquireRefreshLeadership,
  type AuthBroadcastMessage,
} from '@/lib/auth/cross-tab-auth';

export type SessionExpiryState = 'active' | 'warning' | 'grace' | 'expired';

const SESSION_WARNING_SECONDS =
  parseInt(process.env.NEXT_PUBLIC_SESSION_EXPIRY_WARNING_MINUTES || '5', 10) * 60;
const SESSION_GRACE_SECONDS =
  parseInt(process.env.NEXT_PUBLIC_SESSION_GRACE_SECONDS || '30', 10);
const TOKEN_REFRESH_BUFFER =
  parseInt(process.env.NEXT_PUBLIC_TOKEN_REFRESH_BUFFER || '60', 10);

interface AuthContextType {
  user: AuthUser | null;
  role: AuthRole | null;
  permissions: AuthPermission[];
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpiryState: SessionExpiryState;
  secondsUntilExpiry: number;
  hasRole: (role: AuthRole) => boolean;
  hasAnyRole: (roles: AuthRole[]) => boolean;
  hasPermission: (permission: AuthPermission) => boolean;
  canAccessRoute: (path: string) => { allowed: boolean; reason?: string };
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  renewSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

// Check if a path is public
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use hydration-safe state initialization
  const isHydrated = useHydrated();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiryState, setSessionExpiryState] = useState<SessionExpiryState>('active');
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const syncProfile = useCallback(async (token: string): Promise<AuthUser | null> => {
    if (!token) {
      return null
    }

    try {
      const profile = await getProfileApi(token)
      storeUser(profile)
      setUser(profile)
      return profile
    } catch (error) {
      reportError(error, 'AuthContext', 'error', { operation: 'syncProfile' })
      return null;
    }
  }, []);

  // Initialize auth state from storage - runs only on client after hydration
  useEffect(() => {
    // Skip initialization on server
    if (!isClient()) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const storedUser = getUser();
        const token = getAccessToken();

        if (storedUser && token && !isTokenExpired()) {
          const synced = await syncProfile(token);
          if (!synced) {
            clearAuthData();
            setUser(null);
          }
        } else if (hasRefreshToken()) {
          // Try to refresh the token
          const success = await refreshTokenSilently();
          if (!success) {
            clearAuthData();
            setUser(null);
          }
        } else {
          clearAuthData();
          setUser(null);
        }
      } catch (error) {
        reportError(error, 'AuthContext', 'error', { operation: 'initAuth' });
        clearAuthData();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [syncProfile]);

  // Silent token refresh (no loading state)
  const refreshTokenSilently = useCallback(async (): Promise<boolean> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await refreshApi(refreshToken);
      if (!response.accessToken || !response.refreshToken) {
        return false;
      }

      // Store new tokens (backend returns 15min access token)
      storeTokens(response.accessToken, response.refreshToken, 900);
      const profile = await syncProfile(response.accessToken);
      if (!profile) {
        return false;
      }

      broadcastAuthEvent((window as any).__csAuthChannel ?? null, 'refresh');
      return true;
    } catch (error) {
      reportError(error, 'AuthContext', 'warning', { operation: 'refreshToken' });
      return false;
    }
  }, [syncProfile]);

  // Manual token refresh
  const refreshToken = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await refreshTokenSilently();
      return success;
    } finally {
      setIsLoading(false);
    }
  }, [refreshTokenSilently]);

  // Renew session — same as refreshToken but semantically scoped to expiry UX
  const renewSession = useCallback(async (): Promise<boolean> => {
    const success = await refreshTokenSilently();
    if (success) {
      setSessionExpiryState('active');
    }
    return success;
  }, [refreshTokenSilently]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true)
    try {
      const response = await loginApi(credentials)

      if (!response.accessToken || !response.refreshToken) {
        throw new Error('Authentication response is missing tokens')
      }

      storeTokens(response.accessToken, response.refreshToken, 900)
      const profile = await syncProfile(response.accessToken)
      if (!profile) {
        throw new Error('Unable to load user profile after login')
      }

      broadcastAuthEvent((window as any).__csAuthChannel ?? null, 'login')
      router.push('/')
    } catch (error) {
      reportError(error, 'AuthContext', 'error', { operation: 'login' })
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [router, syncProfile])

  // Register function
  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true)
    try {
      const response = await registerApi(credentials)

      if (!response.accessToken || !response.refreshToken) {
        throw new Error('Registration response is missing tokens')
      }

      storeTokens(response.accessToken, response.refreshToken, 900)
      const profile = await syncProfile(response.accessToken)
      if (!profile) {
        throw new Error('Unable to load user profile after registration')
      }

      router.push('/')
    } catch (error) {
      reportError(error, 'AuthContext', 'error', { operation: 'register' })
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [router, syncProfile])

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshToken = getRefreshToken();

      // Call backend logout if refresh token exists
      if (refreshToken) {
        try {
          await logoutApi(refreshToken);
        } catch (error) {
          reportError(error, 'AuthContext', 'warning', { operation: 'backendLogout' });
          // Continue with client-side logout even if backend fails
        }
      }
    } finally {
      // Always clear client-side data
      clearAuthData();
      setUser(null);
      setIsLoading(false);

      // Redirect to login
      router.push('/login');
    }
  }, [router]);

  // Session expiry tracking: drives countdown banner and auto-refresh
  useEffect(() => {
    if (!user) {
      setSessionExpiryState('active');
      setSecondsUntilExpiry(0);
      return;
    }

    let graceStartTime: number | null = null;
    let lastRefreshAttempt = 0;

    const tick = async () => {
      const expiry = getTokenExpiry();
      if (!expiry) return;

      const now = Date.now();
      const remaining = Math.floor((expiry - now) / 1000);

      if (remaining > SESSION_WARNING_SECONDS) {
        setSessionExpiryState('active');
        setSecondsUntilExpiry(remaining);
        graceStartTime = null;
      } else if (remaining > 0) {
        setSessionExpiryState('warning');
        setSecondsUntilExpiry(remaining);
        graceStartTime = null;

        // Attempt silent auto-refresh within the refresh buffer window
        if (remaining <= TOKEN_REFRESH_BUFFER && now - lastRefreshAttempt > 30000) {
          lastRefreshAttempt = now;
          // Only the elected leader tab performs proactive refresh (#550)
          if (tryAcquireRefreshLeadership()) {
            await refreshTokenSilently();
          }
          // Non-leaders pick up new tokens via storage / BroadcastChannel
        }
      } else {
        // Access token has expired — start / continue grace period
        if (!graceStartTime) graceStartTime = now;
        const graceRemaining = Math.max(
          0,
          SESSION_GRACE_SECONDS - Math.floor((now - graceStartTime) / 1000),
        );

        if (graceRemaining > 0) {
          setSessionExpiryState('grace');
          setSecondsUntilExpiry(graceRemaining);
        } else {
          // Grace period over — force logout
          setSessionExpiryState('expired');
          clearAuthData();
          setUser(null);
          if (!isPublicRoute(pathname)) {
            router.push('/login');
          }
        }
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [user, pathname, router, refreshTokenSilently]);

  // Cross-tab auth sync (#550): BroadcastChannel + storage events
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    const channel = createAuthChannel();
    (window as any).__csAuthChannel = channel;

    const handleRemoteLogout = () => {
      clearAuthData();
      setUser(null);
      if (!isPublicRoute(pathname || '/')) {
        router.push('/login');
      }
    };

    const handleRemoteLoginOrRefresh = async () => {
      const token = getAccessToken();
      if (!token) {
        handleRemoteLogout();
        return;
      }
      if (isTokenExpired(token)) {
        const ok = await refreshTokenSilently();
        if (!ok) handleRemoteLogout();
        return;
      }
      await syncProfile(token);
    };

    const onBroadcast = (event: MessageEvent<AuthBroadcastMessage>) => {
      const msg = event.data;
      if (!msg || msg.source === undefined) return;
      if (msg.type === 'logout') {
        handleRemoteLogout();
      } else if (msg.type === 'login' || msg.type === 'refresh' || msg.type === 'profile') {
        void handleRemoteLoginOrRefresh();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (!isAuthStorageKey(event.key)) return;
      if (event.key === 'cs_access_token' && !event.newValue) {
        handleRemoteLogout();
        return;
      }
      if (event.key === 'cs_access_token' && event.newValue) {
        void handleRemoteLoginOrRefresh();
        return;
      }
      if (event.key === 'cs_user' && event.newValue) {
        void handleRemoteLoginOrRefresh();
      }
      if (event.key === 'cs_auth_event' && event.newValue) {
        try {
          const msg = JSON.parse(event.newValue) as AuthBroadcastMessage;
          if (msg.type === 'logout') handleRemoteLogout();
          else if (msg.type === 'login' || msg.type === 'refresh') void handleRemoteLoginOrRefresh();
        } catch {
          // ignore
        }
      }
    };

    channel?.addEventListener('message', onBroadcast);
    window.addEventListener('storage', onStorage);

    return () => {
      channel?.removeEventListener('message', onBroadcast);
      channel?.close();
      window.removeEventListener('storage', onStorage);
      if ((window as any).__csAuthChannel === channel) {
        delete (window as any).__csAuthChannel;
      }
    };
  }, [isHydrated, pathname, router, refreshTokenSilently, syncProfile]);

  // Protect routes - only runs after hydration
  useEffect(() => {

    if (!isHydrated) return;
    if (isLoading) return; // Wait for auth initialization

    const currentPath = pathname || '/';

    if (!user && !isPublicRoute(currentPath)) {
      // Redirect to login if not authenticated
      router.push('/login');
    } else if (user && isPublicRoute(currentPath)) {
      // Redirect to dashboard if already authenticated
      router.push('/');
    }
  }, [user, isLoading, pathname, router, isHydrated]);

  const role: AuthRole | null = user ? normalizeRole(user.role) : null;
  const permissions = user ? getPermissionsForRole(user.role) : [];

  const hasRole = useCallback(
    (expected: AuthRole) => !!role && role === expected,
    [role],
  );

  const hasAnyRole = useCallback(
    (roles: AuthRole[]) => !!role && roles.includes(role),
    [role],
  );

  const hasPermission = useCallback(
    (permission: AuthPermission) => permissions.includes(permission),
    [permissions],
  );

  const canAccessRoute = useCallback(
    (path: string) => canAccessRouteByRole(path, role),
    [role],
  );

  const value: AuthContextType = {
    user,
    role,
    permissions,
    isLoading,
    isAuthenticated: !!user,
    sessionExpiryState,
    secondsUntilExpiry,
    hasRole,
    hasAnyRole,
    hasPermission,
    canAccessRoute,
    login,
    register,
    logout,
    refreshToken,
    renewSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};