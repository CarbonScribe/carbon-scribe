'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PlaceBidPayload } from '@/types/auction';
import { useRateLimitCountdown } from '@/hooks/useRateLimitCountdown';

export const HIGH_BID_THRESHOLD_PERCENT = 25;
export const HIGH_TOTAL_COST_THRESHOLD = 100000;

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
  highBidThresholdPercent?: number;
  highTotalCostThreshold?: number;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface BidReviewDialogProps {
  bidPrice: number;
  quantity: number;
  totalCost: number;
  currentPrice: number;
  requiresAcknowledgement: boolean;
  premiumPercent: number;
  placingBid: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function BidReviewDialog({
  bidPrice,
  quantity,
  totalCost,
  currentPrice,
  requiresAcknowledgement,
  premiumPercent,
  placingBid,
  onConfirm,
  onCancel,
}: BidReviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const confirmedRef = useRef(false);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = dialogRef.current;
    if (container) {
      const focusable = getFocusable(container);
      focusable[0]?.focus();
    }
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!placingBid) onCancel();
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const confirmDisabled =
    placingBid || (requiresAcknowledgement && !acknowledged);

  const handleConfirm = () => {
    if (confirmDisabled || confirmedRef.current) return;
    confirmedRef.current = true;
    onConfirm();
  };

  useEffect(() => {
    if (!placingBid) confirmedRef.current = false;
  }, [placingBid]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bid-review-title"
        onKeyDown={handleKeyDown}
        className="corporate-card w-full max-w-md p-5 space-y-4"
      >
        <h4 id="bid-review-title" className="font-bold text-gray-900 dark:text-white text-base">
          Review your bid
        </h4>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Price per tCO₂</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{formatCurrency(bidPrice)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Quantity</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{formatNumber(quantity)} tCO₂</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Total cost</dt>
            <dd className="font-bold text-corporate-blue">{formatCurrency(totalCost)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Current auction price</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{formatCurrency(currentPrice)}</dd>
          </div>
        </dl>

        {requiresAcknowledgement && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <p>
                This bid is {premiumPercent.toFixed(1)}% above the current price or its total
                cost exceeds {formatCurrency(HIGH_TOTAL_COST_THRESHOLD)}. Please confirm it is intended.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="h-4 w-4"
              />
              <span>I understand this bid is above the usual range and is binding.</span>
            </label>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Bids are binding once placed.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={placingBid}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="flex-1 corporate-btn-primary py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {placingBid ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Placing Bid…
              </>
            ) : (
              'Confirm Bid'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  highBidThresholdPercent = HIGH_BID_THRESHOLD_PERCENT,
  highTotalCostThreshold = HIGH_TOTAL_COST_THRESHOLD,
}: PlaceBidFormProps) {
  const [bidPrice, setBidPrice] = useState<string>(currentPrice.toFixed(2));
  const [quantity, setQuantity] = useState<string>('1');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const submittingRef = useRef(false);
  const rateLimit = useRateLimitCountdown(bidRateLimitError);

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

  const premiumPercent =
    currentPrice > 0 && !isNaN(numericBidPrice)
      ? ((numericBidPrice - currentPrice) / currentPrice) * 100
      : 0;

  const requiresAcknowledgement =
    premiumPercent > highBidThresholdPercent || totalCost > highTotalCostThreshold;

  // Unlock submission state once the pending request finishes.
  useEffect(() => {
    if (!placingBid) submittingRef.current = false;
  }, [placingBid]);

  const validate = (): boolean => {
    if (isNaN(numericBidPrice) || numericBidPrice <= 0) {
      setValidationError('Bid price must be a positive number.');
      return false;
    }
    if (numericBidPrice < floorPrice) {
      setValidationError(
        `Bid price cannot be below the floor price (${formatCurrency(floorPrice)}).`,
      );
      return false;
    }
    if (isNaN(numericQuantity) || numericQuantity < 1) {
      setValidationError('Quantity must be at least 1 tCO₂.');
      return false;
    }
    if (numericQuantity > maxQuantity) {
      setValidationError(
        `Only ${formatNumber(maxQuantity)} tCO₂ remaining in this auction.`,
      );
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rateLimit.isBlocked) return;
    onClearFeedback();
    if (placingBid || submittingRef.current) return;
    if (!validate()) return;
    setReviewOpen(true);
  };

  const handleCancel = useCallback(() => {
    setReviewOpen(false);
  }, []);

  const handleConfirm = async () => {
    if (placingBid || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await onPlaceBid({ bidPrice: numericBidPrice, quantity: numericQuantity });
    } finally {
      setReviewOpen(false);
    }
  };

  if (!isActive) {
    return (
      <div className="corporate-card p-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Bidding is not available — this auction is not currently active.
      </div>
    );
  }

  const submitLabel = rateLimit.isBlocked
    ? `Retry in ${rateLimit.secondsLeft}s`
    : 'Review Bid';

  return (
    <>
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
            Current price: {formatCurrency(currentPrice)} · Floor:{' '}
            {formatCurrency(floorPrice)}
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
            Max: {formatNumber(maxQuantity)} tCO₂
          </p>
        </div>

        {validationError && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <p>{validationError}</p>
          </div>
        )}

        {bidError && !rateLimit.isBlocked && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <p>{bidError}</p>
          </div>
        )}

        {bidSuccess && (
          <div className="flex items-start gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle size={15} className="mt-0.5 shrink-0" />
            <p>{bidSuccess}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={placingBid || rateLimit.isBlocked}
          className="w-full corporate-btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {placingBid && <Loader2 size={15} className="animate-spin" />}
          {submitLabel}
        </button>

        {rateLimit.isBlocked && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Too many attempts — try again in {rateLimit.secondsLeft}s
          </p>
        )}
      </form>

      {reviewOpen && (
        <BidReviewDialog
          bidPrice={numericBidPrice}
          quantity={numericQuantity}
          totalCost={totalCost}
          currentPrice={currentPrice}
          requiresAcknowledgement={requiresAcknowledgement}
          premiumPercent={premiumPercent}
          placingBid={placingBid}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}
