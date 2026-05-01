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
} from '@/lib/auth/token-storage';

interface AuthContextType {
  user: AuthUser | null;
  role: AuthRole | null;
  permissions: AuthPermission[];
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AuthRole) => boolean;
  hasAnyRole: (roles: AuthRole[]) => boolean;
  hasPermission: (permission: AuthPermission) => boolean;
  canAccessRoute: (path: string) => { allowed: boolean; reason?: string };
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

// Check if a path is public
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => path.startsWith(route));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const syncProfile = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const profile = await getProfileApi(token);
      storeUser(profile);
      setUser(profile);
      return profile;
    } catch (error) {
      console.error('Profile sync failed:', error);
      return null;
    }
  }, []);

  // Initialize auth state from storage
  useEffect(() => {
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
        console.error('Auth initialization failed:', error);
        clearAuthData();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [syncProfile]);

  // Silent token refresh (no loading state)
  const refreshTokenSilently = async (): Promise<boolean> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await refreshApi(refreshToken);
      
      // Store new tokens (backend returns 15min access token)
      storeTokens(response.accessToken, response.refreshToken, 900);
      const profile = await syncProfile(response.accessToken);
      if (!profile) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  // Manual token refresh
  const refreshToken = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await refreshTokenSilently();
      return success;
    } finally {
      setIsLoading(false);
    }
  }, [syncProfile]);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await loginApi(credentials);
      
      // Store tokens (access token expires in 15min = 900s)
      storeTokens(response.accessToken, response.refreshToken, 900);
      const profile = await syncProfile(response.accessToken);
      if (!profile) {
        throw new Error('Unable to load user profile after login');
      }

      // Redirect to dashboard or previous page
      router.push('/');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router, syncProfile]);

  // Register function
  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const response = await registerApi(credentials);
      
      // Store tokens (access token expires in 15min = 900s)
      storeTokens(response.accessToken, response.refreshToken, 900);
      const profile = await syncProfile(response.accessToken);
      if (!profile) {
        throw new Error('Unable to load user profile after registration');
      }

      // Redirect to dashboard
      router.push('/');
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router, syncProfile]);

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
          console.error('Backend logout failed:', error);
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

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!user) return;

    // Check every minute if token needs refresh
    const interval = setInterval(async () => {
      if (isTokenExpired(60)) { // 60 seconds buffer
        const success = await refreshTokenSilently();
        if (!success) {
          // Refresh failed - clear auth and redirect to login
          clearAuthData();
          setUser(null);
          
          if (!isPublicRoute(pathname)) {
            router.push('/login');
          }
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user, pathname, router]);

  // Protect routes
  useEffect(() => {
    if (isLoading) return; // Wait for auth initialization

    const currentPath = pathname || '/';
    
    if (!user && !isPublicRoute(currentPath)) {
      // Redirect to login if not authenticated
      router.push('/login');
    } else if (user && isPublicRoute(currentPath)) {
      // Redirect to dashboard if already authenticated
      router.push('/');
    }
  }, [user, isLoading, pathname, router]);

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
    hasRole,
    hasAnyRole,
    hasPermission,
    canAccessRoute,
    login,
    register,
    logout,
    refreshToken,
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
