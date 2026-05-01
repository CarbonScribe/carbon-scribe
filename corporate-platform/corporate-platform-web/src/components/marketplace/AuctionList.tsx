'use client';

import { RefreshCw, AlertCircle, Loader2, Gavel } from 'lucide-react';
import { Auction } from '@/types/auction';
import AuctionCard from './AuctionCard';

interface AuctionListProps {
  auctions: Auction[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export default function AuctionList({
  auctions,
  loading,
  error,
  onRefresh,
}: AuctionListProps) {
  const active = auctions.filter((a) => a.status === 'active');
  const others = auctions.filter((a) => a.status !== 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-corporate-blue" size={36} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="corporate-card p-8 text-center">
        <AlertCircle className="mx-auto mb-3 text-red-500" size={32} />
        <p className="text-gray-700 dark:text-gray-300 mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="corporate-btn-primary px-4 py-2 text-sm"
        >
          <RefreshCw size={14} className="mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (auctions.length === 0) {
    return (
      <div className="corporate-card p-12 text-center">
        <Gavel className="mx-auto mb-4 text-gray-400" size={48} />
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No Auctions Available
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Check back soon — new auctions are added regularly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active auctions */}
      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Auctions
            <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({active.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {active.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </section>
      )}

      {/* Pending / ended / settled auctions */}
      {others.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Other Auctions
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({others.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {others.map((auction) => (
              <AuctionCard key={auction.id} auction={auction} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
