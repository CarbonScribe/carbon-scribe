'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, X, ArrowUpDown, DollarSign, MapPin, Calendar } from 'lucide-react';
import { useCredits, useCreditFilters } from '@/hooks/useCredits';
import type { CreditQueryParams, CreditSummary } from '@/types/credit.types';
import Link from 'next/link';

interface CreditListingProps {
  compact?: boolean;
  onSelect?: (credit: CreditSummary) => void;
}

export default function CreditListing({ compact = false, onSelect }: CreditListingProps) {
  const [filters, setFilters] = useState<CreditQueryParams>({
    page: 1,
    limit: 20,
    sort: 'score_desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, error, refetch } = useCredits(filters);
  const { data: filterOptions } = useCreditFilters();

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ page: 1, limit: 20, sort: 'score_desc' });
    setSearchTerm('');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange('search', searchTerm);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">⚠️ Failed to load credits</div>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data?.credits || data.credits.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">No credits found</h3>
        <p className="text-gray-600 mb-4">
          Try adjusting your filters or search criteria
        </p>
        <button
          onClick={clearFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Clear Filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by project name, country, or methodology..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </form>

        {/* Filter Options */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <select
                value={filters.country || ''}
                onChange={(e) => handleFilterChange('country', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Countries</option>
                {filterOptions?.countries.map((country) => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Methodology</label>
              <select
                value={filters.methodology || ''}
                onChange={(e) => handleFilterChange('methodology', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Methodologies</option>
                {filterOptions?.methodologies.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sort || 'score_desc'}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="score_desc">Quality Score (High to Low)</option>
                <option value="price_asc">Price (Low to High)</option>
                <option value="price_desc">Price (High to Low)</option>
                <option value="vintage_desc">Vintage (Newest)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Info */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Showing {data.credits.length} of {data.total} credits
        </p>
      </div>

      {/* Credit List */}
      <div className="space-y-3">
        {data.credits.map((credit) => (
          <Link
            key={credit.id}
            href={`/corporate/marketplace/credits/${credit.id}`}
            className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSelect?.(credit)}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {credit.projectName}
                </h3>
                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                  {credit.country && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {credit.country}
                    </span>
                  )}
                  {credit.methodology && (
                    <span>{credit.methodology}</span>
                  )}
                  {credit.vintage && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {credit.vintage}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Quality Score */}
                {credit.dynamicScore && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {credit.dynamicScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">Quality Score</div>
                  </div>
                )}

                {/* Price */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 flex items-center gap-1">
                    <DollarSign className="h-5 w-5" />
                    {credit.pricePerTon}
                  </div>
                  <div className="text-xs text-gray-500">per ton CO₂</div>
                </div>

                {/* Available Amount */}
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-800">
                    {credit.availableAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">tons available</div>
                </div>

                {/* Status Badge */}
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  credit.status === 'AVAILABLE'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {credit.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {data.hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => handleFilterChange('page', (filters.page || 1) + 1)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
