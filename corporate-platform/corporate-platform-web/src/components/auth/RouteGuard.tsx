'use client';

import { ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AccessDenied from '@/components/auth/AccessDenied';

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

interface RouteGuardProps {
  children: ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname() || '/';
  const { isLoading, isAuthenticated, canAccessRoute } = useAuth();

  const access = useMemo(() => canAccessRoute(pathname), [canAccessRoute, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500 dark:text-gray-400">
        Loading session...
      </div>
    );
  }

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    // AuthContext handles redirects. Avoid flashing protected content.
    return null;
  }

  if (!access.allowed) {
    return <AccessDenied message={access.reason} />;
  }

  return <>{children}</>;
}
