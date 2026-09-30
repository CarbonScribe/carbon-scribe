import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { AuthPermission, AuthRole } from '@/types/auth.types';

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: AuthRole): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

/**
 * Hook to check if user has any of the specified roles
 */
export function useHasAnyRole(roles: AuthRole[]): boolean {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(roles);
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(permission: AuthPermission): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

/**
 * Hook to check route access by role mapping
 */
export function useCanAccessRoute(path: string): {
  allowed: boolean;
  reason?: string;
} {
  const { canAccessRoute } = useAuth();
  return canAccessRoute(path);
}

/**
 * Hook to get user's company ID
 */
export function useCompanyId(): string | null {
  const { user } = useAuth();
  return user?.companyId || null;
}

/**
 * Hook to require authentication for a component
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook to redirect authenticated users away from public pages
 */
export function useRedirectIfAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/corporate');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
