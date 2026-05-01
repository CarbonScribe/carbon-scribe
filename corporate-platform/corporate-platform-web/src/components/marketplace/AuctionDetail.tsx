'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
  Clock,
  TrendingDown,
  Layers,
  MapPin,
  Calendar,
  Shield,
} from 'lucide-react';
import { useAuctionDetail } from '@/hooks/useAuction';
import PlaceBidForm from './PlaceBidForm';
import BidHistoryTable from './BidHistoryTable';
import { AuctionStatus } from '@/types/auction';

const STATUS_STYLES: Record<AuctionStatus, string> = {
  active:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ended: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  settled:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function timeRemaining(endTime: string): string {
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

interface AuctionDetailProps {
  auctionId: string;
}

export default function AuctionDetail({ auctionId }: AuctionDetailProps) {
  const {
    auction,
    bids,
    loading,
    bidsLoading,
    error,
    bidError,
    bidSuccess,
    placingBid,
    placeBid,
    refresh,
    clearBidFeedback,
  } = useAuctionDetail(auctionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-corporate-blue" size={40} />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="corporate-card p-10 text-center max-w-md mx-auto mt-10">
        <AlertCircle className="mx-auto mb-3 text-red-500" size={36} />
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          {error ?? 'Auction not found.'}
        </p>
        <button
          onClick={refresh}
          className="corporate-btn-primary px-4 py-2 text-sm"
        >
          <RefreshCw size={14} className="mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const isActive = auction.status === 'active';
  const priceDropPct =
    auction.startPrice > 0
      ? (
          ((auction.startPrice - auction.currentPrice) / auction.startPrice) *
          100
        ).toFixed(1)
      : '0';

  return (
    <div className="space-y-6 animate-in">
      {/* Back link + refresh */}
      <div className="flex items-center justify-between">
        <Link
          href="/marketplace/auctions"
          className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-corporate-blue dark:hover:text-corporate-blue transition-colors"
        >
          <ArrowLeft size={16} />
          All Auctions
        </Link>
        <button
          onClick={refresh}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-corporate-blue dark:text-gray-400 dark:hover:text-corporate-blue transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Hero card */}
      <div className="bg-linear-to-r from-corporate-navy via-corporate-blue to-corporate-teal rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[auction.status]}`}
              >
                {auction.status.toUpperCase()}
              </span>
              {isActive && (
                <span className="flex items-center gap-1 text-sm text-blue-200">
                  <Clock size={14} />
                  {timeRemaining(auction.endTime)} remaining
                </span>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-1">
              {auction.credit?.projectName ?? `Auction #${auction.id.slice(0, 8)}`}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-blue-100 mt-2">
              {auction.credit?.country && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {auction.credit.country}
                </span>
              )}
              {auction.credit?.vintage && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> Vintage {auction.credit.vintage}
                </span>
              )}
              {auction.credit?.verificationStandard && (
                <span className="flex items-center gap-1">
                  <Shield size={13} /> {auction.credit.verificationStandard}
                </span>
              )}
            </div>
          </div>

          {/* Live price panel */}
          <div className="lg:text-right">
            <div className="text-4xl font-bold">
              ${auction.currentPrice.toFixed(2)}
              <span className="text-lg font-normal text-blue-200">/ton</span>
            </div>
            {Number(priceDropPct) > 0 && (
              <div className="flex items-center gap-1 text-sm text-red-300 lg:justify-end mt-1">
                <TrendingDown size={14} />
                {priceDropPct}% below start price
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Start Price', value: `$${auction.startPrice.toFixed(2)}` },
          { label: 'Floor Price', value: `$${auction.floorPrice.toFixed(2)}` },
          {
            label: 'Remaining',
            value: (
              <span className="flex items-center gap-1">
                <Layers size={14} />
                {auction.remaining.toLocaleString()} tCO₂
              </span>
            ),
          },
          {
            label: 'Price Drop Every',
            value: `${auction.decrementInterval} min`,
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="corporate-card p-4"
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {label}
            </div>
            <div className="font-bold text-gray-900 dark:text-white">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Bid form + history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PlaceBidForm
            auctionId={auctionId}
            currentPrice={auction.currentPrice}
            floorPrice={auction.floorPrice}
            maxQuantity={auction.remaining}
            isActive={isActive}
            placingBid={placingBid}
            bidError={bidError}
            bidSuccess={bidSuccess}
            onPlaceBid={placeBid}
            onClearFeedback={clearBidFeedback}
          />
        </div>
        <div className="lg:col-span-2">
          <BidHistoryTable bids={bids} bidsLoading={bidsLoading} />
        </div>
      </div>
    </div>
  );
}
