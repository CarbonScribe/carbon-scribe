'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ConnectivityProvider } from '@/contexts/ConnectivityContext'
import RouteGuard from '@/components/auth/RouteGuard'
import CorporateNavbar from '@/components/layout/CorporateNavbar'
import CorporateSidebar from '@/components/layout/CorporateSidebar'
import AuthNavbar from '@/components/layout/AuthNavbar'
import ConnectionStatus from '@/components/layout/ConnectionStatus'
import SessionExpiryBanner from '@/components/layout/SessionExpiryBanner'
import SessionTimeoutModal from '@/components/layout/SessionTimeoutModal'
import { ClientOnly } from '@/components/common/ClientOnly'
import { SkipLink } from '@/components/common/SkipLink'

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route))
}

interface PlatformShellProps {
  children: ReactNode
}

export default function PlatformShell({ children }: PlatformShellProps) {
  const pathname = usePathname() || '/'
  const { isLoading, isAuthenticated } = useAuth()
  const publicRoute = isPublicRoute(pathname)

  // Focus management on route change - return focus to main content
  useEffect(() => {
    if (!isLoading && isAuthenticated && !publicRoute) {
      const mainContent = document.querySelector('main[role="main"]')
      if (mainContent && !document.activeElement?.closest('main')) {
        setTimeout(() => {
          mainContent.setAttribute('tabindex', '-1')
          ;(mainContent as HTMLElement).focus()
          mainContent.removeAttribute('tabindex')
        }, 100)
      }
    }
  }, [pathname, isLoading, isAuthenticated, publicRoute])

  // Public routes - render with AuthNavbar
  if (publicRoute) {
    return (
      <ConnectivityProvider>
        <div className="flex min-h-screen flex-col">
          <SkipLink />
          <AuthNavbar />
          <main className="flex-1" id="main-content" role="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </ConnectivityProvider>
    )
  }

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <ConnectivityProvider>
        <div
          className="flex min-h-screen items-center justify-center text-gray-500 dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-corporate-blue border-t-transparent"
              aria-hidden="true"
            />
            <span>Loading session...</span>
          </div>
        </div>
      </ConnectivityProvider>
    )
  }

  // Not authenticated - render nothing (redirect handled by AuthContext)
  if (!isAuthenticated) {
    return null
  }

  // Authenticated - render full shell with hydration-safe content
  return (
    <ConnectivityProvider>
      <div className="flex min-h-screen">
        <CorporateSidebar />
        <div className="flex flex-1 flex-col">
          <ClientOnly fallback={<div className="h-12" />}>
            <SessionExpiryBanner />
            <SessionTimeoutModal />
          </ClientOnly>
          <CorporateNavbar />
          <ConnectionStatus />
          <main
            id="main-content"
            className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 focus:outline-none"
            role="main"
            aria-label="Main content"
            tabIndex={-1}
          >
            <div className="mx-auto w-full max-w-7xl">
              <RouteGuard>{children}</RouteGuard>
            </div>
          </main>
        </div>
      </div>
    </ConnectivityProvider>
  )
}
