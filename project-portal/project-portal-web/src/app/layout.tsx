import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import PortalNavbar from '@/components/PortalNavbar';
import PortalSidebar from '@/components/PortalSidebar';
import { FarmerProvider } from '@/contexts/FarmerContext';
import { Toaster } from 'sonner';
import ToastContainer from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CarbonScribe Project Portal - Farmer Dashboard',
  description: 'Manage your regenerative agriculture projects and carbon credits',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${inter.className} bg-linear-to-br from-emerald-50 via-white to-cyan-50 min-h-screen`}>
        <FarmerProvider>
          <Toaster position="top-right" richColors closeButton />
          <ToastContainer />
          <PortalNavbar />
          <div className="flex">
            <PortalSidebar />
            <main className="flex-1 p-4 md:p-6 lg:p-8 transition-all duration-300">
              {children}
            </main>
          </div>
        </FarmerProvider>
      </body>
    </html>
  );
}
