'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { PlaceBidPayload } from '@/types/auction';

/** Bids more than this fraction above the current price require extra acknowledgement. */
export const HIGH_BID_PREMIUM_THRESHOLD = 0.25;
/** Totals above this amount (USD) require extra acknowledgement. */
export const HIGH_TOTAL_COST_THRESHOLD = 100000;

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
  highPremiumThreshold?: number;
  highTotalCostThreshold?: number;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(undefined);

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
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
  highPremiumThreshold = HIGH_BID_PREMIUM_THRESHOLD,
  highTotalCostThreshold = HIGH_TOTAL_COST_THRESHOLD,
}: PlaceBidFormProps) {
  const [bidPrice, setBidPrice] = useState<string>(currentPrice.toFixed(2));
  const [quantity, setQuantity] = useState<string>('1');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);

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

  const premiumRatio =
    currentPrice > 0 && !isNaN(numericBidPrice)
      ? (numericBidPrice - currentPrice) / currentPrice
      : 0;
  const isHighPremium = premiumRatio > highPremiumThreshold;
  const isHighTotal = totalCost > highTotalCostThreshold;
  const requiresAcknowledgement = isHighPremium || isHighTotal;

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

  const closeReview = useCallback(() => {
    setReviewOpen(false);
    setAcknowledged(false);
    // Return focus to the element that opened the dialog
    triggerRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearFeedback();
    if (!validate()) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    setAcknowledged(false);
    setReviewOpen(true);
  };

  const handleConfirm = async () => {
    if (submittingRef.current || placingBid) return;
    if (requiresAcknowledgement && !acknowledged) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onPlaceBid({ bidPrice: numericBidPrice, quantity: numericQuantity });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      closeReview();
    }
  };

  const busy = placingBid || submitting;

  // Focus management + keyboard handling for the review dialog
  useEffect(() => {
    if (!reviewOpen) return;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy) closeReview();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [reviewOpen, busy, closeReview]);

  if (!isActive) {
    return (
      <div className="corporate-card p-5 text-center text-sm text-gray-500 dark:text-gray-400">
        Bidding is not available — this auction is not currently active.
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="corporate-card p-5 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-white text-base">
          Place a Bid
        </h3>

        {/* Bid Price */}
        <div>
          <label
            htmlFor="bid-price"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Bid Price ($/tCO₂)
          </label>
          <input
            id="bid-price"
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
            disabled={busy}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Current price: {formatCurrency(currentPrice)} · Floor:{' '}
            {formatCurrency(floorPrice)}
          </p>
        </div>

        {/* Quantity */}
        <div>
          <label
            htmlFor="bid-quantity"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Quantity (tCO₂)
          </label>
          <input
            id="bid-quantity"
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
            disabled={busy}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Max: {formatNumber(maxQuantity)} tCO₂
          </p>
        </div>

        {/* Total cost preview */}
        {totalCost > 0 && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Estimated total:{' '}
            </span>
            <span className="font-bold text-corporate-blue">
              {formatCurrency(totalCost)}
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
          disabled={busy}
          className="w-full corporate-btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Review Bid
        </button>
      </form>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bid-review-title"
            className="corporate-card w-full max-w-md p-6 space-y-4"
          >
            <h3
              id="bid-review-title"
              className="font-bold text-gray-900 dark:text-white text-base"
            >
              Review your bid
            </h3>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Price per tonne</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(numericBidPrice)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Quantity</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatNumber(numericQuantity)} tCO₂
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Current auction price</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(currentPrice)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <dt className="font-semibold text-gray-700 dark:text-gray-300">
                  Total cost
                </dt>
                <dd className="font-bold text-corporate-blue">
                  {formatCurrency(totalCost)}
                </dd>
              </div>
            </dl>

            {requiresAcknowledgement && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    {isHighPremium && (
                      <p>
                        This bid is {(premiumRatio * 100).toFixed(1)}% above the
                        current price (threshold{' '}
                        {(highPremiumThreshold * 100).toFixed(0)}%).
                      </p>
                    )}
                    {isHighTotal && (
                      <p>
                        The total cost exceeds{' '}
                        {formatCurrency(highTotalCostThreshold)}.
                      </p>
                    )}
                  </div>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <span>
                    I understand this bid is binding and confirm the amount above.
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeReview}
                disabled={busy}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy || (requiresAcknowledgement && !acknowledged)}
                className="flex-1 corporate-btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? (
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
      )}
    </>
  );
}
