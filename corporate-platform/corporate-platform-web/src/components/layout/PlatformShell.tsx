'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ConnectivityProvider } from '@/contexts/ConnectivityContext'
import RouteGuard from '@/components/auth/RouteGuard'
import CorporateNavbar from '@/components/layout/CorporateNavbar'
import CorporateSidebar from '@/components/layout/CorporateSidebar'
import AuthNavbar from '@/components/layout/AuthNavbar'
import ConnectionStatus from '@/components/layout/ConnectionStatus'

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

  if (publicRoute) {
    return (
      <ConnectivityProvider>
        <div className="flex min-h-screen flex-col">
          <AuthNavbar />
          <main className="flex-1">{children}</main>
        </div>
      </ConnectivityProvider>
    )
  }

  if (isLoading) {
    return (
      <ConnectivityProvider>
        <div className="flex min-h-screen items-center justify-center text-gray-500 dark:text-gray-400">
          Loading session...
        </div>
      </ConnectivityProvider>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <ConnectivityProvider>
      <div className="flex min-h-screen">
        <CorporateSidebar />
        <div className="flex flex-1 flex-col">
          <CorporateNavbar />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">
              <RouteGuard>{children}</RouteGuard>
            </div>
          </main>
        </div>
      </div>
    </ConnectivityProvider>
  )
}