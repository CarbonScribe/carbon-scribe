'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallback,
}) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useRequireAuth();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return fallback || <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

const LoadingScreen: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
    <div className="text-center">
      <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-400 border-t-blue-500"></div>
      <p className="text-lg font-medium text-slate-200">Loading...</p>
    </div>
  </div>
);
