'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PlaceBidPayload } from '@/types/auction';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';

interface PlaceBidFormProps {
  auctionId: string;
  currentPrice: number;
  floorPrice: number;
  maxQuantity: number;
  isActive: boolean;
  placingBid: boolean;
  bidError: string | null;
  /** Rate-limit error object powering the retry countdown. */
  bidRateLimitError?: unknown;
  bidSuccess: string | null;
  onPlaceBid: (payload: PlaceBidPayload) => Promise<void>;
  onClearFeedback: () => void;
  highBidThreshold?: number;
  highTotalThreshold?: number;
}

const currency = (value: number) => value.toLocaleString(undefined, {
  style: 'currency', currency: 'USD',
});

export default function PlaceBidForm({
  currentPrice,
  floorPrice,
  maxQuantity,
  isActive,
  placingBid,
  bidError,
  bidRateLimitError,
  bidSuccess,
  onPlaceBid,
  onClearFeedback,
  highBidThreshold = 0.25,
  highTotalThreshold = 100000,
}: PlaceBidFormProps) {
  const [bidPrice, setBidPrice] = useState<string>(currentPrice.toFixed(2));
  const [quantity, setQuantity] = useState<string>('1');
  const [validationError, setValidationError] = useState<string | null>(null);
  const rateLimit = useRateLimitCountdown(bidRateLimitError);
  const [review, setReview] = useState<PlaceBidPayload | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!review) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [review]);

  useEffect(() => { setAcknowledged(false); }, [currentPrice]);

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
        `Bid price cannot be below the floor price (${currency(floorPrice)}).`,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimit.isBlocked || placingBid || pendingRef.current) return;
    onClearFeedback();
    if (!validate()) return;
    setAcknowledged(false);
    setReview({ bidPrice: numericBidPrice, quantity: numericQuantity });
  };

  const highPrice = review !== null && review.bidPrice > currentPrice * (1 + highBidThreshold);
  const highTotal = review !== null && review.bidPrice * review.quantity > highTotalThreshold;
  const confirmBid = async () => {
    if (!review || pendingRef.current || placingBid || rateLimit.isBlocked || !isActive ||
        ((highPrice || highTotal) && !acknowledged)) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onPlaceBid(review);
    } finally {
      setReview(null);
      setPending(false);
      pendingRef.current = false;
    }
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
          Current price: {currency(currentPrice)} · Floor: {currency(floorPrice)}
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
            {currency(totalCost)}
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

      {/* Rate-limit countdown */}
      {rateLimit.isRateLimited && rateLimit.message && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {rateLimit.message}
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
        disabled={placingBid || pending || rateLimit.isBlocked}
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
      {review && (
        <dialog
          ref={dialogRef}
          aria-labelledby="bid-review-title"
          aria-describedby="bid-review-description"
          onCancel={(event) => { event.preventDefault(); if (!pendingRef.current) setReview(null); }}
          className="m-auto w-full max-w-md rounded-xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/50 dark:bg-gray-800 dark:text-white"
        >
          <h2 id="bid-review-title" className="text-lg font-bold">Review your bid</h2>
          <p id="bid-review-description" className="mt-2 text-sm">Bids are binding. Please review the details before confirming.</p>
          <dl className="my-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt>Price per tonne</dt><dd>{currency(review.bidPrice)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Quantity</dt><dd>{review.quantity.toLocaleString()} tCO₂</dd></div>
            <div className="flex justify-between gap-4"><dt>Current auction price</dt><dd>{currency(currentPrice)}</dd></div>
            <div className="flex justify-between gap-4 font-bold"><dt>Total cost</dt><dd>{currency(review.bidPrice * review.quantity)}</dd></div>
          </dl>
          {(highPrice || highTotal) && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              <p role="alert">Warning: {highPrice && `This bid is more than ${highBidThreshold * 100}% above the current auction price.`} {highTotal && `The total exceeds ${currency(highTotalThreshold)}.`}</p>
              <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I understand and confirm these bid details.</label>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" autoFocus disabled={pending || placingBid} onClick={() => setReview(null)} className="rounded-lg border px-4 py-2 disabled:opacity-60">Cancel</button>
            <button type="button" disabled={pending || placingBid || rateLimit.isBlocked || ((highPrice || highTotal) && !acknowledged)} onClick={confirmBid} className="corporate-btn-primary px-4 py-2 disabled:opacity-60">{pending || placingBid ? 'Placing Bid…' : 'Confirm bid'}</button>
          </div>
        </dialog>
      )}
    </form>
  );
}
