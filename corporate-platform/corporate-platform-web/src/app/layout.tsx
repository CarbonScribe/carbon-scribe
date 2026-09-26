import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { CorporateProvider } from '@/contexts/CorporateContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ConnectivityProvider } from '@/contexts/ConnectivityContext'
import PlatformShell from '@/components/layout/PlatformShell'
import { RouteCancellationProvider } from '@/components/common/RouteCancellationProvider'
import { SkipLink } from '@/components/common/SkipLink'
import { ThemeScript } from '@/components/theme/ThemeScript'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'CarbonScribe Corporate Platform - Sustainable Carbon Management',
    template: '%s | CarbonScribe',
  },
  description: 'Purchase, manage, and retire carbon credits with transparent, on-chain verification',
  keywords: ['carbon credits', 'sustainability', 'corporate', 'climate action', 'carbon offset'],
  authors: [{ name: 'CarbonScribe Team' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://carbonscribe.com/',
    title: 'CarbonScribe Corporate Platform - Sustainable Carbon Management',
    description: 'Purchase, manage, and retire carbon credits with transparent, on-chain verification',
    siteName: 'CarbonScribe',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CarbonScribe Corporate Platform - Sustainable Carbon Management',
    description: 'Purchase, manage, and retire carbon credits with transparent, on-chain verification',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  // Cache control for the page itself (handled by Next.js ISR)
  // This is a hint for crawlers and social media previews
  other: {
    'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#111827" media="(prefers-color-scheme: dark)" />
        {/* Inline theme script to prevent FOUC */}
        <ThemeScript />
      </head>
      <body
        className={`${inter.className} min-h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 antialiased`}
        suppressHydrationWarning
      >
        {/* Skip link for keyboard users */}
        <SkipLink />

        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense
            fallback={
              <div
                className="flex min-h-screen items-center justify-center"
                role="status"
                aria-live="polite"
              >
                <span className="sr-only">Loading application...</span>
                <div
                  className="h-8 w-8 animate-spin rounded-full border-4 border-corporate-blue border-t-transparent"
                  aria-hidden="true"
                />
              </div>
            }
          >
            <RouteCancellationProvider>
              <AuthProvider>
                <CorporateProvider>
                  <ConnectivityProvider>
                    <PlatformShell>{children}</PlatformShell>
                  </ConnectivityProvider>
                </CorporateProvider>
              </AuthProvider>
            </RouteCancellationProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}