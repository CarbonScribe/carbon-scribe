'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store/store';
import EmailVerificationBanner from './EmailVerificationBanner';

export default function ProtectedRoute({
  children,
  roles,
  requireVerifiedEmail = true,
}: {
  children: React.ReactNode;
  roles?: string[];
  requireVerifiedEmail?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const isHydrated = useStore((s) => s.isHydrated);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const user = useStore((s) => s.user);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    // Check email verification for protected routes
    if (requireVerifiedEmail && user && !user.email_verified) {
      // Allow access but show verification banner
      // Don't redirect - let the banner handle it
      return;
    }

    if (roles?.length && user?.role && !roles.includes(user.role)) {
      router.replace('/'); // or a /403 page later
    }
  }, [isHydrated, isAuthenticated, router, pathname, roles, user?.role, requireVerifiedEmail, user]);

  const renderLoading = (message: string) => (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );

  // Prevent blank screen during hydration
  if (!isHydrated) return renderLoading('Preparing your dashboard...');

  // While redirecting unauthenticated users
  if (!isAuthenticated) return renderLoading('Redirecting to login...');

  // RBAC failed
  if (roles?.length && user?.role && !roles.includes(user.role)) {
    return renderLoading('Checking access permissions...');
  }

  return (
    <>
      {/* Show verification banner for unverified users */}
      {requireVerifiedEmail && user && !user.email_verified && (
        <EmailVerificationBanner className="mb-4" />
      )}
      {children}
    </>
  );
}