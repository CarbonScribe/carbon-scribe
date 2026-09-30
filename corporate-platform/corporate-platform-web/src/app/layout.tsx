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
    // favicon.ico in src/app/ is served by Next.js App Router automatically.
    // apple-touch-icon.png is served by src/app/apple-icon.tsx (App Router).
    // Additional PNG favicons are served by src/app/icon.tsx (App Router).
    // No static paths needed here — App Router wires these up automatically.
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  // manifest.ts in src/app/ generates the /manifest.webmanifest route.
  manifest: '/manifest.webmanifest',
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
        {/* theme-color matches manifest.ts theme_color (#1a5db5) for light,
            and corporate-navy (#0a2540) for dark — consistent with the brand palette */}
        <meta name="theme-color" content="#1a5db5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a2540" media="(prefers-color-scheme: dark)" />
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