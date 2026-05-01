'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
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

  const visibleNavigation = navigation.filter((item) => {
    if (!isAuthenticated) return false
    return canAccessRoute(item.href).allowed
  })

  return (
    <aside className={`
      hidden lg:flex flex-col
      ${collapsed ? 'w-20' : 'w-64'}
      border-r border-gray-200 dark:border-gray-800
      bg-white dark:bg-gray-900
      transition-all duration-300 ease-in-out
      relative
    `}>
      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 z-10"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logo */}
      <div className={`
        flex items-center
        ${collapsed ? 'justify-center p-4' : 'space-x-3 p-6'}
        border-b border-gray-200 dark:border-gray-800
      `}>
        <div className="w-8 h-8 bg-linear-to-br from-corporate-blue to-corporate-teal rounded-lg flex items-center justify-center">
          <Zap size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <h2 className="font-bold text-lg">CarbonScribe</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Corporate</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-linear-to-r from-corporate-blue/10 to-corporate-teal/10 text-corporate-blue dark:text-blue-300 border-l-4 border-corporate-blue' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
                ${collapsed ? 'justify-center' : 'justify-between'}
              `}
            >
              <div className="flex items-center">
                <item.icon size={20} className={collapsed ? '' : 'mr-3'} />
                {!collapsed && item.name}
              </div>
              {!collapsed && item.badge && (
                <span className={`
                  px-2 py-1 text-xs rounded-full
                  ${isActive 
                    ? 'bg-corporate-blue text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }
                `}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Quick Stats */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="bg-linear-to-r from-corporate-navy/5 to-corporate-blue/5 dark:from-gray-800/50 dark:to-gray-800/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Credits Available</span>
              <span className="text-sm font-bold text-corporate-blue">25,000</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-linear-to-r from-corporate-teal to-corporate-blue h-2 rounded-full" 
                style={{ width: '75%' }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">75% of quarterly target</p>
          </div>
        </div>
      )}
    </aside>
  )
}