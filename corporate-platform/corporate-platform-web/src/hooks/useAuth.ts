import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: string): boolean {
  const { user } = useAuth();
  return user?.role === role;
}

/**
 * Hook to check if user has any of the specified roles
 */
export function useHasAnyRole(roles: string[]): boolean {
  const { user } = useAuth();
  return user ? roles.includes(user.role) : false;
}

/**
 * Hook to get user's company ID
 */
export function useCompanyId(): string | null {
  const { user } = useAuth();
  return user?.companyId || null;
}

/**
 * Hook to check if session is about to expire
 * @param warningSeconds - Seconds before expiry to trigger warning
 */
export function useSessionWarning(warningSeconds: number = 300): {
  isExpiring: boolean;
  timeRemaining: number;
} {
  const { isAuthenticated } = useAuth();
  const [isExpiring, setIsExpiring] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsExpiring(false);
      setTimeRemaining(0);
      return;
    }

    const checkExpiry = () => {
      const tokenExpiryStr = localStorage.getItem('cs_token_expiry');
      if (!tokenExpiryStr) {
        setIsExpiring(false);
        setTimeRemaining(0);
        return;
      }

      const expiry = parseInt(tokenExpiryStr, 10);
      const now = Date.now();
      const remaining = expiry - now;

      setTimeRemaining(Math.max(0, Math.floor(remaining / 1000)));
      setIsExpiring(remaining > 0 && remaining <= warningSeconds * 1000);
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, warningSeconds]);

  return { isExpiring, timeRemaining };
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
