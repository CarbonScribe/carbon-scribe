'use client';

import { useStore } from '@/lib/store/store';
import { Menu, Bell, Search, Globe, User, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const PortalNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const user = useStore((s) => s.user);
  const isHydrated = useStore((s) => s.isHydrated);
  const logout = useStore((s) => s.logout);

  const displayName = user?.full_name || 'Guest';
  const subtitle = user ? 'Verified Partner' : 'Not signed in';

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg lg:hidden transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-linear-to-r from-emerald-500 to-teal-600 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-linear-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
                  CarbonScribe
                </h1>
                <p className="text-xs text-gray-600">Project Portal</p>
              </div>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects, credits, or analytics..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            {/* Language Selector */}
            <button className="hidden md:flex items-center space-x-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Globe className="w-5 h-5" />
              <span className="font-medium">EN</span>
            </button>

            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-700" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <div className="font-medium text-gray-900">
                  {isHydrated ? displayName : '...'}
                </div>
                <div className="text-sm text-gray-600">{subtitle}</div>
              </div>
              <button className="p-2 bg-linear-to-r from-emerald-100 to-teal-100 rounded-full">
                <User className="w-6 h-6 text-emerald-700" />
              </button>

              {isHydrated && !user && (
                <button
                  onClick={() => router.push('/login')}
                  className="hidden md:inline-flex px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Login
                </button>
              )}

              {isHydrated && user && (
                <button
                  onClick={() => logout()}
                  className="hidden md:inline-flex px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black transition"
                >
                  Logout
                </button>
              )}

            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className={`mt-3 md:hidden transition-all duration-300 ${mobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PortalNavbar;
