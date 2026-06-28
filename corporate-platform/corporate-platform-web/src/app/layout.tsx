import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { CorporateProvider } from '@/contexts/CorporateContext'
import { AuthProvider } from '@/contexts/AuthContext'
import PlatformShell from '@/components/layout/PlatformShell'
import { RouteCancellationProvider } from '@/components/common/RouteCancellationProvider'

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
          <RouteCancellationProvider>
            <AuthProvider>
              <CorporateProvider>
                <PlatformShell>{children}</PlatformShell>
              </CorporateProvider>
            </AuthProvider>
          </RouteCancellationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

