'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';

export const useAuth = () => {
  const state = useAuthStore();

  return {
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    isAuthenticated: state.isAuthenticated,
    login: state.login,
    register: state.register,
    logout: state.logout,
    clearError: state.clearError,
  };
};

export const useAuthInit = () => {
  const { getCurrentUser, isLoading } = useAuthStore();

  useEffect(() => {
    getCurrentUser();
  }, [getCurrentUser]);

  return isLoading;
};

export const useRequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Return both to let components decide how to handle loading
  return { isAuthenticated, isLoading };
};
