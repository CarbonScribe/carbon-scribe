'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Bell, Settings, User, ChevronDown, Menu, X, LogOut } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useCorporate } from '@/contexts/CorporateContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAccessibility } from '@/hooks/useAccessibility'
import { useAnnouncement } from '@/hooks/useAnnouncement'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { IconButton } from '@/components/common/IconButton'
import { AccessibleIcon } from '@/components/common/AccessibleIcon'
import { BadgeAnnouncer } from '@/components/common/BadgeAnnouncer'
import { reportError } from '@/lib/telemetry/errorReporter'

export default function CorporateNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { toggleTheme, theme, mounted } = useTheme()
  const { company, cart } = useCorporate()
  const { user, logout, isAuthenticated } = useAuth()
  const { labels, getCartLabel } = useAccessibility()
  const { announce } = useAnnouncement()
  const menuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const cartCount = cart.length
  const cartLabel = getCartLabel(cartCount)

  // Focus trap for mobile menu
  const { containerRef: mobileMenuContainer } = useFocusTrap({
    active: isMobileMenuOpen,
    autoFocus: true,
    onFocusTrap: () => {
      announce('Mobile navigation menu opened', 'polite')
    },
  })

  // Focus trap for user menu
  const { containerRef: userMenuContainer } = useFocusTrap({
    active: showUserMenu,
    autoFocus: true,
    onFocusTrap: () => {
      announce('User menu opened', 'polite')
    },
  })

  const handleLogout = async () => {
    try {
      await logout()
      setShowUserMenu(false)
      announce('You have been logged out', 'polite')
    } catch (error) {
      reportError(error, 'CorporateNavbar', 'warning', { operation: 'logout' })
      announce('Logout failed, please try again', 'assertive')
    }
  }

  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark')
    toggleTheme()
    announce(isDark ? 'Light theme activated' : 'Dark theme activated', 'polite')
  }

  const handleToggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
    announce(isMobileMenuOpen ? 'Navigation menu closed' : 'Navigation menu opened', 'polite')
  }

  const handleToggleUserMenu = () => {
    setShowUserMenu(!showUserMenu)
  }

  // Keyboard shortcuts (Ctrl+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector(
          'input[type="search"]'
        ) as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          announce('Search input focused', 'polite')
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [announce])

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileMenuOpen])

  // Keyboard shortcut documentation
  const shortcutHint = 'Press Ctrl+K to search'

  // Don't render theme toggle until mounted to avoid hydration mismatch
  if (!mounted) return null

  return (
    <header 
      className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md"
      role="banner"
    >
      <div className="px-4 md:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <IconButton
              label={labels.toggleNavigation}
              onClick={handleToggleMobileMenu}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
            >
              <AccessibleIcon hidden aria-hidden="true">
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </AccessibleIcon>
            </IconButton>
            
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 bg-linear-to-br from-corporate-blue to-corporate-teal rounded-lg" 
                aria-hidden="true"
              ></div>
              <div>
                <h1 className="font-bold text-lg bg-linear-to-r from-corporate-navy to-corporate-blue dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
                  CarbonScribe
                </h1>
                <p className="text-xs text-text-muted dark:text-gray-400">Corporate Platform</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <AccessibleIcon hidden aria-hidden="true">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </AccessibleIcon>
              <input
                type="search"
                placeholder={`${labels.searchCredits} (Ctrl+K)`}
                aria-label={labels.searchCredits}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2 placeholder:text-text-muted dark:placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <IconButton
              label={labels.toggleTheme}
              onClick={handleToggleTheme}
              aria-pressed={document.documentElement.classList.contains('dark')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
            >
              <AccessibleIcon hidden aria-hidden="true">
                {document.documentElement.classList.contains('dark') ? '🌞' : '🌙'}
              </AccessibleIcon>
            </IconButton>

            {/* Cart */}
            <div className="relative">
              <IconButton
                label={cartLabel}
                onClick={() => {}} // Placeholder - cart toggle will be handled by parent
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
              >
                <AccessibleIcon hidden aria-hidden="true">
                  <div className="w-5 h-5 flex items-center justify-center">🛒</div>
                </AccessibleIcon>
                {cartCount > 0 && (
                  <>
                    <span 
                      className="absolute -top-1 -right-1 bg-status-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {cartCount}
                    </span>
                    <BadgeAnnouncer 
                      count={cartCount} 
                      label="Cart items" 
                    />
                  </>
                )}
              </IconButton>
            </div>

            {/* Notifications */}
            <div className="relative">
              <IconButton
                label={labels.viewNotifications}
                onClick={() => {}} // Placeholder - notifications toggle
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
              >
                <AccessibleIcon hidden aria-hidden="true">
                  <Bell size={20} />
                </AccessibleIcon>
                <span 
                  className="absolute top-1 right-1 w-2 h-2 bg-status-error rounded-full"
                  aria-hidden="true"
                ></span>
                <span className="sr-only">You have unread notifications</span>
              </IconButton>
            </div>

            {/* User Profile with Dropdown */}
            {isAuthenticated && user && (
              <div className="hidden md:block relative" ref={userMenuRef}>
                <button
                  onClick={handleToggleUserMenu}
                  className="flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-all focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  aria-controls="user-menu"
                >
                  <div className="text-right">
                    <p className="font-medium text-sm text-text-primary dark:text-white">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-text-muted dark:text-gray-400">{user.email}</p>
                  </div>
                  <div className="relative">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center text-white font-medium" aria-hidden="true">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-status-success rounded-full border-2 border-white dark:border-gray-900" aria-hidden="true"></div>
                  </div>
                  <AccessibleIcon hidden aria-hidden="true">
                    <ChevronDown size={16} className="text-gray-400" />
                  </AccessibleIcon>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div 
                    id="user-menu"
                    ref={(el) => {
                      userMenuRef.current = el
                      userMenuContainer.current = el
                    }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 focus:outline-none"
                    role="menu"
                    aria-label="User menu"
                    tabIndex={-1}
                  >
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700" role="none">
                      <p className="text-sm font-medium text-text-primary dark:text-white" role="menuitem">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-text-muted dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    
                    <div className="py-1" role="none">
                      <a
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
                        role="menuitem"
                      >
                        <AccessibleIcon hidden aria-hidden="true">
                          <Settings size={16} className="mr-3" />
                        </AccessibleIcon>
                        Settings
                      </a>
                      <a
                        href="/profile"
                        className="flex items-center px-4 py-2 text-sm text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
                        role="menuitem"
                      >
                        <AccessibleIcon hidden aria-hidden="true">
                          <User size={16} className="mr-3" />
                        </AccessibleIcon>
                        Profile
                      </a>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 py-1" role="none">
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-status-error dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        role="menuitem"
                        aria-label={labels.logout}
                      >
                        <AccessibleIcon hidden aria-hidden="true">
                          <LogOut size={16} className="mr-3" />
                        </AccessibleIcon>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings */}
            <IconButton
              label={labels.openSettings}
              onClick={() => {}} // Placeholder - settings navigation
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
            >
              <AccessibleIcon hidden aria-hidden="true">
                <Settings size={20} />
              </AccessibleIcon>
            </IconButton>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden mt-4">
          <div className="relative">
            <AccessibleIcon hidden aria-hidden="true">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </AccessibleIcon>
            <input
              type="search"
              placeholder="Search..."
              aria-label="Search credits, projects, or analytics..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2 placeholder:text-text-muted dark:placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          id="mobile-menu"
          ref={(el) => {
            mobileMenuRef.current = el
            mobileMenuContainer.current = el
          }}
          className="lg:hidden border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 focus:outline-none"
          role="navigation"
          aria-label="Mobile navigation"
          tabIndex={-1}
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-linear-to-br from-corporate-blue to-corporate-teal rounded-full flex items-center justify-center text-white font-medium" aria-hidden="true">
                {company?.name?.charAt(0) || 'C'}
              </div>
              <div>
                <p className="font-medium text-text-primary dark:text-white">{company?.name || 'Company'}</p>
                <p className="text-sm text-text-muted dark:text-gray-400">{company?.industry || 'Industry'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                className="corporate-btn-secondary focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2" 
                aria-label="View profile"
              >
                Profile
              </button>
              <button 
                className="corporate-btn-primary focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2" 
                aria-label="Retire credits"
              >
                Retire Credits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcut hint - visually hidden but accessible */}
      <span className="sr-only">{shortcutHint}</span>
    </header>
  )
}