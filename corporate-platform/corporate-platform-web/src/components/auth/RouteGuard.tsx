'use client';

import { ReactNode, useMemo, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectivity } from '@/contexts/ConnectivityContext';
import AccessDenied from '@/components/auth/AccessDenied';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import type { AuthRole, AuthPermission } from '@/types/auth.types';

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

interface RouteGuardProps {
  children: ReactNode;
  requiredRoles?: AuthRole[];
  requiredPermissions?: AuthPermission[];
}

export default function RouteGuard({ 
  children, 
  requiredRoles = [], 
  requiredPermissions = [] 
}: RouteGuardProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { 
    isLoading, 
    isAuthenticated, 
    canAccessRoute, 
    hasRole, 
    hasPermission,
    user 
  } = useAuth();
  const { state: { isOnline } } = useConnectivity();
  const { announce } = useAnnouncement();
  const [redirectAttempted, setRedirectAttempted] = useState(false);

  const access = useMemo(() => canAccessRoute(pathname), [canAccessRoute, pathname]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute(pathname) && !redirectAttempted) {
      setRedirectAttempted(true);
      announce('Redirecting to login page', 'polite');
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, pathname, router, redirectAttempted, announce]);

  // Loading state with accessibility
  if (isLoading) {
    return (
      <div 
        className="min-h-[40vh] flex items-center justify-center text-gray-500 dark:text-gray-400"
        role="status"
        aria-live="polite"
        aria-label="Loading session"
      >
        <div className="flex flex-col items-center gap-3">
          <div 
            className="h-8 w-8 animate-spin rounded-full border-4 border-corporate-blue border-t-transparent"
            aria-hidden="true"
          />
          <span>Loading session...</span>
        </div>
      </div>
    );
  }

  // Public routes - accessible without authentication
  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // Not authenticated - return null (redirect handled by useEffect)
  if (!isAuthenticated) {
    return null;
  }

  // Check offline status
  if (!isOnline) {
    return (
      <div 
        className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center dark:border-yellow-900/50 dark:bg-yellow-900/20"
        role="alert"
        aria-live="assertive"
        aria-label="You are offline"
      >
        <div className="flex flex-col items-center gap-3">
          <span 
            className="text-4xl"
            aria-hidden="true"
          >
            📡
          </span>
          <p className="text-yellow-800 dark:text-yellow-200">
            You are offline. Some features may be unavailable.
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-300">
            Please check your internet connection and try again.
          </p>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => hasRole(role));
    if (!hasRequiredRole) {
      announce('Access denied: Insufficient role permissions', 'assertive');
      return (
        <AccessDenied 
          message="You don't have the required role permissions to access this page."
        />
      );
    }
  }

  // Check permission-based access
  if (requiredPermissions.length > 0) {
    const hasRequiredPermission = requiredPermissions.some(permission => hasPermission(permission));
    if (!hasRequiredPermission) {
      announce('Access denied: Insufficient permissions', 'assertive');
      return (
        <AccessDenied 
          message="You don't have the required permissions to access this page."
        />
      );
    }
  }

  // Additional route-specific checks
  if (!access.allowed) {
    announce(`Access denied: ${access.reason || 'Unauthorized'}`, 'assertive');
    return <AccessDenied message={access.reason} />;
  }

  // All checks passed - render children
  return <>{children}</>;
}