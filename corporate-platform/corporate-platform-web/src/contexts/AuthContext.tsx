'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { AuthUser, LoginCredentials, RegisterCredentials } from '@/types/auth.types';
import {
  loginApi,
  registerApi,
  refreshApi,
  logoutApi,
  getProfileApi,
} from '@/lib/api/auth.api';
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
  isLoading: boolean;
  isAuthenticated: boolean;
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

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = getUser();
        const token = getAccessToken();

        if (storedUser && token && !isTokenExpired()) {
          setUser(storedUser);
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
  }, []);

  // Silent token refresh (no loading state)
  const refreshTokenSilently = async (): Promise<boolean> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await refreshApi(refreshToken);
      
      // Store new tokens (backend returns 15min access token)
      storeTokens(response.accessToken, response.refreshToken, 900);
      storeUser(response.user);
      setUser(response.user);
      
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
  }, []);

  // Login function
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await loginApi(credentials);
      
      // Store tokens (access token expires in 15min = 900s)
      storeTokens(response.accessToken, response.refreshToken, 900);
      storeUser(response.user);
      setUser(response.user);

      // Redirect to dashboard or previous page
      router.push('/corporate');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Register function
  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const response = await registerApi(credentials);
      
      // Store tokens (access token expires in 15min = 900s)
      storeTokens(response.accessToken, response.refreshToken, 900);
      storeUser(response.user);
      setUser(response.user);

      // Redirect to dashboard
      router.push('/corporate');
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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
      router.push('/corporate');
    }
  }, [user, isLoading, pathname, router]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
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
