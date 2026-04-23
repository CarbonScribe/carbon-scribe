'use client';

import React, { useEffect } from 'react';
import { useAuthInit } from '@/hooks/use-auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // This hook will initialize auth state on app load
  const isInitializing = useAuthInit();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-400 border-t-blue-500"></div>
          <p className="text-lg font-medium text-slate-200">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
