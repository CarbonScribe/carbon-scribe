'use client';

import Link from 'next/link';
import { Clock, Tag, Layers, TrendingDown, AlertCircle } from 'lucide-react';
import { Auction, AuctionStatus } from '@/types/auction';

interface AuctionCardProps {
  auction: Auction;
}

const STATUS_STYLES: Record<AuctionStatus, string> = {
  active:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ended: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  settled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function timeRemaining(endTime: string): string {
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AuctionCard({ auction }: AuctionCardProps) {
  const isActive = auction.status === 'active';
  const priceDropPct =
    auction.startPrice > 0
      ? (
          ((auction.startPrice - auction.currentPrice) / auction.startPrice) *
          100
        ).toFixed(1)
      : '0';

  return (
    <Link href={`/marketplace/auctions/${auction.id}`}>
      <div className="corporate-card hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer">
        {/* Header */}
        <div className="relative h-36 bg-linear-to-br from-corporate-navy/20 to-corporate-teal/20 rounded-t-xl p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[auction.status]}`}
            >
              {auction.status.toUpperCase()}
            </span>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock size={12} />
                {timeRemaining(auction.endTime)}
              </span>
            )}
          </div>
          <div>
            <div className="text-2xl font-bold text-corporate-navy dark:text-white">
              ${auction.currentPrice.toFixed(2)}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                /ton
              </span>
            </div>
            {Number(priceDropPct) > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-500">
                <TrendingDown size={12} />
                {priceDropPct}% below start price
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate">
            {auction.credit?.projectName ?? `Auction #${auction.id.slice(0, 8)}`}
          </h3>

          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {auction.credit?.country && (
              <div className="flex items-center gap-1">
                <Tag size={13} />
                {auction.credit.country}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Layers size={13} />
              {auction.remaining.toLocaleString()} / {auction.quantity.toLocaleString()} tCO₂ remaining
            </div>
          </div>

          {/* Price range bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Floor ${auction.floorPrice.toFixed(2)}</span>
              <span>Start ${auction.startPrice.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-corporate-blue h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.max(
                    5,
                    ((auction.currentPrice - auction.floorPrice) /
                      Math.max(
                        auction.startPrice - auction.floorPrice,
                        0.01,
                      )) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>

          {isActive && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
              <AlertCircle size={12} />
              Dutch auction — price drops every {auction.decrementInterval} min
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
