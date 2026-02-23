'use client';

import { Home, FolderKanban, BarChart3, Satellite, CreditCard, Users, FileText, Settings, LogOut, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from '@/lib/store/store';
import Link from 'next/link';

const PortalSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const logout = useStore((s) => s.logout);

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/', active: pathname === '/' },
    { icon: FolderKanban, label: 'Projects', href: '/projects', active: pathname.includes('/projects') },
    { icon: BarChart3, label: 'Analytics', href: '/analytics', active: pathname.includes('/analytics') },
    { icon: Satellite, label: 'Monitoring', href: '/monitoring', active: pathname.includes('/monitoring') },
    { icon: CreditCard, label: 'Financing', href: '/financing', active: pathname.includes('/financing') },
    { icon: Users, label: 'Team', href: '/team', active: pathname.includes('/team') },
    { icon: FileText, label: 'Documents', href: '/documents', active: pathname.includes('/documents') },
    { icon: Settings, label: 'Settings', href: '/settings', active: pathname.includes('/settings') },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
        {/* Toggle Button */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
          >
            <ChevronLeft className={`w-5 h-5 text-gray-600 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center p-3 rounded-xl transition-all duration-200 ${
                  item.active
                    ? 'bg-linear-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200'
                    : 'text-gray-700 hover:bg-gray-100 hover:scale-102'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="ml-3 font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => logout()}
            className="flex items-center p-3 text-gray-700 hover:bg-gray-100 rounded-xl w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-3 font-medium">Log Out</span>}
          </button>
          
          {/* Project Status */}
          {!collapsed && (
            <div className="mt-4 p-3 bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl">
              <div className="text-sm font-medium text-emerald-800">Active Projects</div>
              <div className="text-2xl font-bold text-emerald-900 mt-1">6</div>
              <div className="text-xs text-emerald-600">All systems operational</div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around py-3">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                  item.active ? 'text-emerald-600 bg-emerald-50' : 'text-gray-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default PortalSidebar;
