'use client';

import { Loader2 } from 'lucide-react';
import { Bid, BidStatus } from '@/types/auction';

interface BidHistoryTableProps {
  bids: Bid[];
  bidsLoading: boolean;
}

const BID_STATUS_STYLES: Record<BidStatus, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  accepted:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  outbid:
    'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BidHistoryTable({
  bids,
  bidsLoading,
}: BidHistoryTableProps) {
  return (
    <div className="corporate-card p-5">
      <h3 className="font-bold text-gray-900 dark:text-white mb-4">
        Bid History
        {bids.length > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({bids.length})
          </span>
        )}
      </h3>

      {bidsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-corporate-blue" size={24} />
        </div>
      ) : bids.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
          No bids placed yet. Be the first to bid!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">
                  Bidder
                </th>
                <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">
                  Price / tCO₂
                </th>
                <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">
                  Qty (tCO₂)
                </th>
                <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">
                  Status
                </th>
                <th className="pb-2 font-medium text-gray-600 dark:text-gray-400">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {bids.map((bid) => (
                <tr key={bid.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-2.5 text-gray-900 dark:text-white font-mono text-xs">
                    {bid.user?.name ?? bid.userId.slice(0, 8) + '…'}
                  </td>
                  <td className="py-2.5 font-semibold text-gray-900 dark:text-white">
                    ${bid.bidPrice.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-gray-700 dark:text-gray-300">
                    {bid.quantity.toLocaleString()}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${BID_STATUS_STYLES[bid.status]}`}
                    >
                      {bid.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(bid.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
