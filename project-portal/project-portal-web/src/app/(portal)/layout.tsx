'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import PortalNavbar from '@/components/PortalNavbar';
import PortalSidebar from '@/components/PortalSidebar';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
      >
        Skip to main content
      </a>
      <PortalNavbar />
      <div className="flex min-h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)] overflow-hidden">
        <PortalSidebar />
        <main id="main-content" className="flex-1 p-4 md:p-6 lg:p-8 bg-white/30 backdrop-blur-[1px] overflow-y-auto" tabIndex={-1}>{children}</main>
      </div>
    </ProtectedRoute>
  );
}
