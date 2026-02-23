'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import PortalNavbar from '@/components/PortalNavbar';
import PortalSidebar from '@/components/PortalSidebar';
import ToastContainer from '@/components/ui/Toast';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <ProtectedRoute> uncomment when backend auth is implemented
    <>
      <ToastContainer />
      <PortalNavbar />
      <div className="flex">
        <PortalSidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </>
    // </ProtectedRoute>
    // For now, we won't enforce auth on the layout since the login/register pages are also under this layout. Once we have backend auth implemented,
    // we can uncomment the ProtectedRoute and it will protect all routes under this layout.
  );
}
