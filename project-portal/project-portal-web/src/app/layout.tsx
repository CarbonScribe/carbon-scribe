import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { FarmerProvider } from '@/contexts/FarmerContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from 'sonner';
import ToastContainer from '@/components/ui/Toast';
import StoreHydrator from '@/components/StoreHydrator';

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
      <body
        suppressHydrationWarning
        className={`${inter.className} min-h-screen bg-linear-to-br from-emerald-50 via-white to-cyan-50 text-gray-900 antialiased`}
      >
        <ThemeProvider>
        <FarmerProvider>
          <StoreHydrator />
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-300/25 blur-3xl" />
            <div className="absolute top-1/3 -right-28 h-104 w-104 rounded-full bg-teal-300/20 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 h-112 w-md rounded-full bg-cyan-300/20 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.5) 1px, transparent 0)',
                backgroundSize: '30px 30px',
              }}
            />
          </div>

          <Toaster position="top-right" richColors closeButton />
          <ToastContainer />
          {children}
        </FarmerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
