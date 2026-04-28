'use client';

import { useStore } from '@/lib/store/store';
import { Menu, Bell, Search, Globe, Sparkles, Sun, Moon, Settings, LogOut, User, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';

const PortalNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const user = useStore((s) => s.user);
  const isHydrated = useStore((s) => s.isHydrated);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const logout = useStore((s) => s.logout);

  const displayName = user?.full_name || 'Guest';
  const email = user?.email || '';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    router.replace('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg lg:hidden transition-colors"
              aria-label="Toggle mobile menu"
            >
              <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-linear-to-r from-emerald-500 to-teal-600 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-linear-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
                  CarbonScribe
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">Project Portal</p>
              </div>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search projects, credits, or analytics..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                aria-label="Search projects, credits, or analytics"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-2">
            {/* Language Selector */}
            <button 
              className="hidden md:flex items-center space-x-1 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Select language, current: English"
            >
              <Globe className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium text-sm">EN</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <button
              aria-label="Notifications, new alerts available"
              className="relative p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
            </button>

            {/* User Avatar + Dropdown */}
            {isHydrated && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-haspopup="true"
                  aria-expanded={profileOpen}
                  aria-label="Open profile menu"
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {/* Avatar circle */}
                  <div className="w-8 h-8 rounded-full bg-linear-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold select-none" aria-hidden="true">
                    {isAuthenticated ? initials : <User className="w-4 h-4" />}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-900 dark:text-gray-100 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className={`hidden md:block w-4 h-4 text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {profileOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50"
                  >
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {displayName}
                      </p>
                      {email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
                      )}
                    </div>

                    <button
                      role="menuitem"
                      onClick={() => { setProfileOpen(false); router.push('/settings'); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <User className="w-4 h-4" aria-hidden="true" />
                      View Profile
                    </button>

                    <button
                      role="menuitem"
                      onClick={() => { setProfileOpen(false); router.push('/settings'); }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Settings className="w-4 h-4" aria-hidden="true" />
                      Account Settings
                    </button>

                    {isAuthenticated && (
                      <>
                        <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                        <button
                          role="menuitem"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4" aria-hidden="true" />
                          Logout
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className={`mt-3 md:hidden transition-all duration-300 ${mobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PortalNavbar;
