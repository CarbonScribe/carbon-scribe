import type { Metadata } from 'next';
import './globals.css';

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
      <body suppressHydrationWarning className={`bg-linear-to-br from-emerald-50 via-white to-cyan-50 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
