'use client';

import { useState } from 'react';
import { Search, BarChart3, TrendingUp } from 'lucide-react';
import CreditListing from '@/components/credits/CreditListing';
import { useCreditStats } from '@/hooks/useCredits';

export default function CreditsPage() {
  const { data: stats, loading } = useCreditStats();
  const [view, setView] = useState<'discover' | 'stats'>('discover');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Carbon Credits</h1>
          <p className="text-gray-600">
            Discover, filter, and evaluate high-quality carbon credits for your portfolio
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('discover')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'discover'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Search className="h-5 w-5" />
            Discover Credits
          </button>
          <button
            onClick={() => setView('stats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'stats'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            Market Statistics
          </button>
        </div>

        {/* Statistics View */}
        {view === 'stats' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm text-gray-600 mb-2">Total Credits</div>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.totalCredits.toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm text-gray-600 mb-2">Available</div>
                <div className="text-3xl font-bold text-green-600">
                  {stats.availableCredits.toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm text-gray-600 mb-2">Avg Price</div>
                <div className="text-3xl font-bold text-yellow-600">
                  ${stats.avgPrice.toFixed(2)}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-sm text-gray-600 mb-2">Avg Quality</div>
                <div className="text-3xl font-bold text-purple-600">
                  {stats.avgQualityScore.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Total Market Value</h2>
              <div className="text-4xl font-bold text-green-600">
                ${stats.totalValue.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Discovery View */}
        {view === 'discover' && <CreditListing />}
      </div>
    </div>
  );
}
