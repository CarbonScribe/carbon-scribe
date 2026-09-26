import { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PortalSidebar from '@/components/PortalSidebar';
import PortalNavbar from '@/components/PortalNavbar';

export default function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute requireVerifiedEmail={true}>
      <div className="flex h-screen bg-gray-50">
        <PortalSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PortalNavbar />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}