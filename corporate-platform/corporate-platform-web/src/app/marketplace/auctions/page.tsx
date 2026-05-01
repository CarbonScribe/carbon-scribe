'use client';

import Link from 'next/link';
import { RefreshCw, Gavel } from 'lucide-react';
import { useAuctionList } from '@/hooks/useAuction';
import AuctionList from '@/components/marketplace/AuctionList';

export default function AuctionsPage() {
  const { auctions, loading, error, refresh } = useAuctionList();

  const activeCount = auctions.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6 animate-in">
      {/* Page header */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 md:p-8 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between">
          <div className="mb-4 lg:mb-0">
            <div className="flex items-center gap-3 mb-2">
              <Gavel size={28} />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Carbon Credit Auctions
              </h1>
            </div>
            <p className="text-blue-100 opacity-90 max-w-xl">
              Participate in Dutch auctions — prices drop over time until
              credits are claimed. Act fast to secure the best price.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-40">
              <div className="text-sm text-blue-200 mb-1">Live Auctions</div>
              <div className="text-2xl font-bold">
                {loading ? '—' : activeCount}
              </div>
              <div className="text-xs text-green-300">Active right now</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 min-w-40">
              <div className="text-sm text-blue-200 mb-1">Total Listed</div>
              <div className="text-2xl font-bold">
                {loading ? '—' : auctions.length}
              </div>
              <div className="text-xs text-blue-300">All statuses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab strip: Credits / Auctions */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
        <Link
          href="/marketplace"
          className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-corporate-blue dark:hover:text-corporate-blue transition-colors"
        >
          Credits
        </Link>
        <span className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold border-b-2 border-corporate-blue text-corporate-blue">
          <Gavel size={14} />
          Auctions
        </span>
      </div>

      {/* Refresh control */}
      <div className="flex justify-end">
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-corporate-blue dark:hover:text-corporate-blue transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Auctions
        </button>
      </div>

      {/* Auction grid */}
      <AuctionList
        auctions={auctions}
        loading={loading}
        error={error}
        onRefresh={refresh}
      />
    </div>
  );
}
