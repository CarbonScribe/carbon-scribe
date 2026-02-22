'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store/store';

export default function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
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

    if (roles?.length && user?.role && !roles.includes(user.role)) {
      router.replace('/'); // or a /403 page later
    }
  }, [isHydrated, isAuthenticated, router, pathname, roles, user?.role]);

  // Prevent flicker during hydration
  if (!isHydrated) return null;

  // While redirecting
  if (!isAuthenticated) return null;

  // RBAC failed
  if (roles?.length && user?.role && !roles.includes(user.role)) return null;

  return <>{children}</>;
}
