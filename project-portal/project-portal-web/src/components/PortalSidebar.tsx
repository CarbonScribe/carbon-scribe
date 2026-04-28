'use client';

import { Home, FolderKanban, BarChart3, Satellite, CreditCard, Users, FileText, Settings, LogOut, ChevronLeft, FileBarChart } from 'lucide-react';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store/store';
import Link from 'next/link';

const navItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: FolderKanban, label: 'Projects', href: '/projects' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: FileBarChart, label: 'Reports', href: '/reports' },
  { icon: Satellite, label: 'Monitoring', href: '/monitoring' },
  { icon: CreditCard, label: 'Financing', href: '/financing' },
  { icon: Users, label: 'Team', href: '/team' },
  { icon: FileText, label: 'Documents', href: '/documents' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

const PortalSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white/95 border-r border-gray-200 h-full max-h-full overflow-hidden transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Toggle Button */}
        <div className="p-3 border-b border-gray-200 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="w-full p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <ChevronLeft
              className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
                collapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <div key={item.label} className="relative group">
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center p-2.5 rounded-xl transition-all duration-200 focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    active
                      ? 'bg-linear-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span
                    className={`ml-2.5 font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
                      collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>

                {/* Tooltip — only visible when collapsed */}
                {collapsed && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50"
                  >
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-gray-200 shrink-0">
          <div className="relative group">
            <button
              type="button"
              title={collapsed ? 'Log Out' : undefined}
              aria-label="Log Out"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
              className="flex items-center p-2.5 text-gray-700 hover:bg-gray-100 rounded-xl w-full transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span
                className={`ml-2.5 font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                }`}
              >
                Log Out
              </span>
            </button>

            {collapsed && (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50"
              >
                Log Out
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
              </div>
            )}
          </div>

          {/* Project Status — hidden when collapsed */}
          <div
            className={`mt-3 p-2.5 bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl overflow-hidden transition-all duration-300 ${
              collapsed ? 'h-0 opacity-0 mt-0 p-0' : 'h-auto opacity-100'
            }`}
            aria-hidden={collapsed}
          >
            <div className="text-sm font-medium text-emerald-800">Active Projects</div>
            <div className="text-xl font-bold text-emerald-900 mt-1">6</div>
            <div className="text-xs text-emerald-600">All systems operational</div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40" aria-label="Mobile navigation">
        <div className="grid grid-cols-6 gap-1 px-2 py-2">
          {[navItems[0], navItems[1], navItems[2], navItems[3], navItems[8]].map((item) => {
            if (!item) return null;
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center p-1.5 rounded-xl transition-colors ${
                  active ? 'text-emerald-600 bg-emerald-50' : 'text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium mt-1 leading-tight text-center">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Log Out"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className="flex flex-col items-center p-1.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[10px] font-medium mt-1 leading-tight">Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default PortalSidebar;
