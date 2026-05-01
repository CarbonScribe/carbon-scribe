import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import CorporateNavbar from '@/components/layout/CorporateNavbar'
import CorporateSidebar from '@/components/layout/CorporateSidebar'
import RouteGuard from '@/components/auth/RouteGuard'
import { CorporateProvider } from '@/contexts/CorporateContext'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CarbonScribe Corporate Platform - Sustainable Carbon Management',
  description: 'Purchase, manage, and retire carbon credits with transparent, on-chain verification',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <CorporateProvider>
              <div className="flex min-h-screen">
                <CorporateSidebar />
                <div className="flex-1 flex flex-col">
                  <CorporateNavbar />
                  <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
                    <div className="max-w-7xl mx-auto w-full">
                      <RouteGuard>{children}</RouteGuard>
                    </div>
                  </main>
                </div>
              </div>
            </CorporateProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

