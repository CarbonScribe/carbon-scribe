'use client'

import Link from 'next/link'
import { LogIn, UserPlus } from 'lucide-react'
import { AccessibleIcon } from '@/components/common/AccessibleIcon'
import { SkipLink } from '@/components/common/SkipLink'

export default function AuthNavbar() {
  return (
    <header 
      className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80"
      role="banner"
    >
      <SkipLink />
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link 
          href="/" 
          className="flex items-center gap-3 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2 focus:outline-none rounded-lg" 
          aria-label="CarbonScribe home"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-green-600 shadow-lg shadow-blue-500/20" aria-hidden="true">
            <span className="text-sm font-bold text-white">CS</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              CarbonScribe
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Corporate Platform Access
            </p>
          </div>
        </Link>

        <nav 
          className="flex items-center gap-2 sm:gap-3" 
          role="navigation" 
          aria-label="Authentication navigation"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2 focus:outline-none"
          >
            <AccessibleIcon hidden aria-hidden="true">
              <LogIn size={16} />
            </AccessibleIcon>
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-blue-600 to-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-blue-700 hover:to-green-700 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2 focus:outline-none"
          >
            <AccessibleIcon hidden aria-hidden="true">
              <UserPlus size={16} />
            </AccessibleIcon>
            Create account
          </Link>
        </nav>
      </div>
    </header>
  )
}