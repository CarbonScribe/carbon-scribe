'use client'

import { useState, useRef } from 'react'
import { Filter, Grid, List, Search, TrendingUp, MapPin, Shield, RefreshCw, AlertCircle } from 'lucide-react'
import { useCorporate } from '@/contexts/CorporateContext'
import { useMarketplace, DEFAULT_FILTERS } from '@/hooks/useMarketplace'
import { MarketplaceCredit, LocalFilterState } from '@/types/marketplace'
import CreditCard from '@/components/marketplace/CreditCard'
import MarketplaceFilters from '@/components/marketplace/MarketplaceFilters'
import CartSidebar from '@/components/marketplace/CartSidebar'

export default function MarketplacePage() {
  const { cart } = useCorporate()
  const {
    credits,
    total,
    page,
    pageSize,
    loading,
    error,
    filters,
    stats,
    availableFilters,
    setFilters,
    setPage,
    refresh,
  } = useMarketplace()

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalPages = Math.ceil(total / pageSize)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setFilters({ ...filters, query: value })
    }, 400)
  }

  const handleFiltersChange = (newFilters: LocalFilterState) => {
    setFilters(newFilters)
  }

  const displayTotalCredits = stats?.totalCredits ?? 0
  const displayAvgPrice = stats?.avgPrice ?? 0
  const displayProjectCount = stats?.projectCount ?? credits.length

  return (
    <div className="space-y-6 animate-in">
      {/* Marketplace Header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 tracking-tight">
              Carbon Credit Marketplace
            </h1>
            <p className="text-blue-100 opacity-90 max-w-2xl">
              Discover and purchase verified carbon credits from high-impact projects worldwide.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Available Credits</div>
              <div className="text-2xl font-bold">{displayTotalCredits.toLocaleString()} tCO₂</div>
              <div className="text-xs text-green-300">Across {displayProjectCount} projects</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-50">
              <div className="text-sm text-blue-200 mb-1">Average Price</div>
              <div className="text-2xl font-bold">
                {displayAvgPrice > 0 ? `$${displayAvgPrice.toFixed(2)}/ton` : '—'}
              </div>
              <div className="text-xs text-blue-300">Real-time market price</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Filters */}
        <div className="lg:w-1/4">
          <MarketplaceFilters
            filters={filters}
            setFilters={handleFiltersChange}
            availableFilters={availableFilters}
          />
        </div>

        {/* Right Column - Credits & Search */}
        <div className="lg:flex-1">
          {/* Search and Controls */}
          <div className="corporate-card p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="search"
                    defaultValue={filters.query}
                    onChange={handleSearchChange}
                    placeholder="Search projects by name, country, or methodology..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
                    aria-label="Grid view"
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
                    aria-label="List view"
                  >
                    <List size={20} />
                  </button>
                </div>
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="relative corporate-btn-primary px-4 py-2"
                >
                  🛒 View Cart
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {cart.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="corporate-card p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                  <MapPin className="text-corporate-blue" size={20} />
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Countries</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats?.countryCount ?? '—'}
                  </div>
                </div>
              </div>
            </div>
            <div className="corporate-card p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-3">
                  <Shield className="text-green-600" size={20} />
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Methodologies</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats?.methodologyCount ?? '—'}
                  </div>
                </div>
              </div>
            </div>
            <div className="corporate-card p-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-3">
                  <TrendingUp className="text-purple-600" size={20} />
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Price Range</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats?.price.min != null && stats?.price.max != null
                      ? `$${stats.price.min}–$${stats.price.max}`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
              <AlertCircle size={20} className="shrink-0" />
              <span className="flex-1 text-sm">{error}</span>
              <button
                onClick={refresh}
                className="flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton / Credits Grid/List */}
          {loading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {Array.from({ length: pageSize }).map((_, i) => (
                <div key={i} className="corporate-card animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-xl" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : credits.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Filter size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No credits found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
                Try adjusting your filters or search query to find available credits.
              </p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="corporate-btn-secondary px-4 py-2"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {credits.map((credit) => (
                <CreditCard key={credit.id} credit={credit as any} viewMode={viewMode} />
              ))}
            </div>
          )}

          {/* Results count */}
          {!loading && credits.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} credits
            </p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <nav className="flex items-center space-x-2" aria-label="Pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="corporate-btn-secondary px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // Show pages around current page
                  const startPage = Math.max(1, page - 3)
                  const p = startPage + i
                  if (p > totalPages) return null
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-2 rounded-lg ${
                        p === page
                          ? 'bg-corporate-blue text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="corporate-btn-secondary px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}