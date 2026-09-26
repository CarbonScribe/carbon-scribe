'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useAccessibility } from '@/hooks/useAccessibility'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { IconButton } from '@/components/common/IconButton'
import { AccessibleIcon } from '@/components/common/AccessibleIcon'
import { 
  Home, 
  ShoppingCart, 
  BarChart3, 
  Globe, 
  FileText, 
  Settings,
  FolderOpen,
  TrendingUp,
  Shield,
  Users,
  Database,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home, badge: null },
  { name: 'Marketplace', href: '/marketplace', icon: ShoppingCart, badge: 'New' },
  { name: 'Portfolio', href: '/portfolio', icon: Database, badge: null },
  { name: 'Retirement', href: '/retirement', icon: TrendingUp, badge: '3' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, badge: null },
  { name: 'Compliance', href: '/compliance', icon: Shield, badge: null },
  { name: 'Documents', href: '/documents', icon: FolderOpen, badge: null },
  { name: 'Reporting', href: '/reporting', icon: FileText, badge: null },
  { name: 'Projects', href: '/projects', icon: Globe, badge: null },
  { name: 'Team', href: '/team', icon: Users, badge: null },
  { name: 'Settings', href: '/settings', icon: Settings, badge: null },
]

export default function CorporateSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { canAccessRoute, isAuthenticated } = useAuth()
  const { labels } = useAccessibility()
  const navRef = useRef<HTMLElement>(null)

  const visibleNavigation = navigation.filter((item) => {
    if (!isAuthenticated) return false
    return canAccessRoute(item.href).allowed
  })

  // Keyboard navigation for sidebar items
  const { containerRef, getItemProps } = useKeyboardNavigation({
    items: visibleNavigation,
    onSelect: (item) => {
      // Navigation handled by Link component
    },
    orientation: 'vertical',
    enabled: !collapsed,
  })

  const handleToggleSidebar = () => {
    setCollapsed(!collapsed)
    // Focus returns to toggle button after collapse
    const toggleButton = document.querySelector(
      '[aria-label="Toggle sidebar"]'
    ) as HTMLButtonElement
    if (toggleButton) {
      setTimeout(() => toggleButton.focus(), 100)
    }
  }

  // Focus trap for collapsed sidebar
  useEffect(() => {
    if (collapsed) {
      // When collapsed, only the toggle button should be focusable
      const navItems = navRef.current?.querySelectorAll('a[role="menuitem"]')
      navItems?.forEach((item) => {
        item.setAttribute('tabIndex', '-1')
      })
    } else {
      // When expanded, restore focusability
      const navItems = navRef.current?.querySelectorAll('a[role="menuitem"]')
      navItems?.forEach((item) => {
        const isActive = item.getAttribute('aria-current') === 'page'
        item.setAttribute('tabIndex', isActive ? '0' : '-1')
      })
    }
  }, [collapsed])

  return (
    <aside 
      className={`
        hidden lg:flex flex-col
        ${collapsed ? 'w-20' : 'w-64'}
        border-r border-gray-200 dark:border-gray-800
        bg-white dark:bg-gray-900
        transition-all duration-300 ease-in-out
        relative
      `}
      role="complementary"
      aria-label="Main navigation sidebar"
      aria-expanded={!collapsed}
    >
      {/* Collapse Button */}
      <IconButton
        label={labels.toggleSidebar}
        onClick={handleToggleSidebar}
        aria-expanded={!collapsed}
        aria-controls="sidebar-navigation"
        className="absolute -right-3 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 z-10 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2"
      >
        <AccessibleIcon hidden aria-hidden="true">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </AccessibleIcon>
      </IconButton>

      {/* Logo */}
      <div 
        className={`
          flex items-center
          ${collapsed ? 'justify-center p-4' : 'space-x-3 p-6'}
          border-b border-gray-200 dark:border-gray-800
        `}
      >
        <div className="w-8 h-8 bg-linear-to-br from-corporate-blue to-corporate-teal rounded-lg flex items-center justify-center" aria-hidden="true">
          <Zap size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <h2 className="font-bold text-lg text-text-primary dark:text-white">CarbonScribe</h2>
            <p className="text-xs text-text-muted dark:text-gray-400">Corporate</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav 
        id="sidebar-navigation"
        ref={(el) => {
          navRef.current = el
          containerRef.current = el
        }}
        className="flex-1 p-4 space-y-1 focus:outline-none"
        role="navigation"
        aria-label="Main navigation"
        onKeyDown={(e) => {
          // Handle arrow key navigation
          if (!collapsed) {
            const items = visibleNavigation
            const currentIndex = items.findIndex(
              (item) => pathname === item.href
            )
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const direction = e.key === 'ArrowDown' ? 1 : -1
              let newIndex = currentIndex + direction
              if (newIndex < 0) newIndex = items.length - 1
              if (newIndex >= items.length) newIndex = 0
              const targetItem = document.querySelector(
                `a[href="${items[newIndex].href}"]`
              ) as HTMLAnchorElement
              if (targetItem) targetItem.focus()
            }
          }
        }}
      >
        {visibleNavigation.map((item, index) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors focus:ring-2 focus:ring-corporate-blue focus:ring-offset-2 focus:outline-none
                ${isActive 
                  ? 'bg-linear-to-r from-corporate-blue/10 to-corporate-teal/10 text-corporate-blue dark:text-blue-300 border-l-4 border-corporate-blue' 
                  : 'text-text-secondary dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
                ${collapsed ? 'justify-center' : 'justify-between'}
              `}
              aria-current={isActive ? 'page' : undefined}
              {...getItemProps(index)}
            >
              <div className="flex items-center">
                <AccessibleIcon hidden aria-hidden="true">
                  <item.icon size={20} className={collapsed ? '' : 'mr-3'} />
                </AccessibleIcon>
                {!collapsed && (
                  <span className="sr-only md:not-sr-only">{item.name}</span>
                )}
                {collapsed && (
                  <span className="sr-only">{item.name}</span>
                )}
              </div>
              {!collapsed && item.badge && (
                <span 
                  className={`
                    px-2 py-1 text-xs rounded-full font-medium
                    ${isActive 
                      ? 'bg-corporate-blue text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-text-secondary dark:text-gray-300'
                    }
                  `}
                  role="status"
                  aria-live="polite"
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Quick Stats */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800" role="complementary" aria-label="Credit stats">
          <div className="bg-linear-to-r from-corporate-navy/5 to-corporate-blue/5 dark:from-gray-800/50 dark:to-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary dark:text-gray-400">Credits Available</span>
              <span className="text-sm font-bold text-corporate-blue dark:text-blue-300" aria-live="polite">25,000</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2" role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>
              <div 
                className="bg-linear-to-r from-corporate-teal to-corporate-blue h-2 rounded-full" 
                style={{ width: '75%' }}
                aria-hidden="true"
              ></div>
            </div>
            <p className="text-xs text-text-muted dark:text-gray-400 mt-2">75% of quarterly target</p>
          </div>
        </div>
      )}
    </aside>
  )
}