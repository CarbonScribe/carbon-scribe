'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PlaceBidPayload } from '@/types/auction';

interface PlaceBidFormProps {
  auctionId: string;
  currentPrice: number;
  floorPrice: number;
  maxQuantity: number;
  isActive: boolean;
  placingBid: boolean;
  bidError: string | null;
  bidSuccess: string | null;
  onPlaceBid: (payload: PlaceBidPayload) => Promise<void>;
  onClearFeedback: () => void;
}

export default function PlaceBidForm({
  currentPrice,
  floorPrice,
  maxQuantity,
  isActive,
  placingBid,
  bidError,
  bidSuccess,
  onPlaceBid,
  onClearFeedback,
}: PlaceBidFormProps) {
  const [bidPrice, setBidPrice] = useState<string>(currentPrice.toFixed(2));
  const [quantity, setQuantity] = useState<string>('1');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Keep bid price in sync with live current price
  useEffect(() => {
    setBidPrice(currentPrice.toFixed(2));
  }, [currentPrice]);

  const numericBidPrice = parseFloat(bidPrice);
  const numericQuantity = parseInt(quantity, 10);
  const totalCost =
    !isNaN(numericBidPrice) && !isNaN(numericQuantity)
      ? numericBidPrice * numericQuantity
      : 0;

  const validate = (): boolean => {
    if (isNaN(numericBidPrice) || numericBidPrice <= 0) {
      setValidationError('Bid price must be a positive number.');
      return false;
    }
    if (numericBidPrice < floorPrice) {
      setValidationError(
        `Bid price cannot be below the floor price ($${floorPrice.toFixed(2)}).`,
      );
      return false;
    }
    if (isNaN(numericQuantity) || numericQuantity < 1) {
      setValidationError('Quantity must be at least 1 tCO₂.');
      return false;
    }
    if (numericQuantity > maxQuantity) {
      setValidationError(
        `Only ${maxQuantity.toLocaleString()} tCO₂ remaining in this auction.`,
      );
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearFeedback();
    if (!validate()) return;
    await onPlaceBid({ bidPrice: numericBidPrice, quantity: numericQuantity });
  };

  if (!isActive) {
    return (
      <div className="corporate-card p-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Bidding is not available — this auction is not currently active.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="corporate-card p-5 space-y-4">
      <h3 className="font-bold text-gray-900 dark:text-white text-base">
        Place a Bid
      </h3>

      {/* Bid Price */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Bid Price ($/tCO₂)
        </label>
        <input
          type="number"
          min={floorPrice}
          step="0.01"
          value={bidPrice}
          onChange={(e) => {
            setBidPrice(e.target.value);
            onClearFeedback();
          }}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          required
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Current price: ${currentPrice.toFixed(2)} · Floor: $
          {floorPrice.toFixed(2)}
        </p>
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Quantity (tCO₂)
        </label>
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            onClearFeedback();
          }}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          required
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Max: {maxQuantity.toLocaleString()} tCO₂
        </p>
      </div>

      {/* Total cost preview */}
      {totalCost > 0 && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Estimated total:{' '}
          </span>
          <span className="font-bold text-corporate-blue">
            ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {validationError}
        </div>
      )}

      {/* API error */}
      {bidError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {bidError}
        </div>
      )}

      {/* Success */}
      {bidSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle size={15} className="shrink-0" />
          {bidSuccess}
        </div>
      )}

      <button
        type="submit"
        disabled={placingBid}
        className="w-full corporate-btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {placingBid ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Placing Bid…
          </>
        ) : (
          'Place Bid'
        )}
      </button>
    </form>
  );
}
