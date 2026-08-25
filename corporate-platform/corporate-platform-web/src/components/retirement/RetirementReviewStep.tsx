'use client';

import { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Loader2,
  Shield,
  Wallet,
} from 'lucide-react';
import type { RetirementReviewSummary } from '@/types/retirement';

interface RetirementReviewStepProps {
  summary: RetirementReviewSummary;
  /** Return to the form with all values intact. Never submits. */
  onBack: () => void;
  /** The only path that actually calls the retirement API. */
  onConfirm: () => void;
  /** True while the retirement request is in flight. */
  retiring: boolean;
}

/**
 * Pre-commit review step for instant retirement (#512).
 *
 * Retirement is irreversible and, until this step existed, the form submitted
 * straight to `POST /retirements` — the only "confirmation" a user ever saw was
 * the receipt printed after the credits were already gone. This screen sits
 * between the last input and the API call, summarising exactly what will
 * happen, and offers a real way back.
 *
 * It is additive: the post-submission success/receipt screen is unchanged.
 */
export default function RetirementReviewStep({
  summary,
  onBack,
  onConfirm,
  retiring,
}: RetirementReviewStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the review heading so screen-reader users are told the form
  // did not submit — it advanced to a confirmation step.
  useEffect(() => {
    const timer = setTimeout(() => headingRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-5" data-testid="retirement-review-step">
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-bold text-gray-900 dark:text-white focus:outline-none"
        >
          Review Retirement
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Retirement is permanent and cannot be undone. Check the details below
          before confirming.
        </p>
      </div>

      <div
        className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
        role="note"
      >
        <AlertTriangle
          size={18}
          className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          Confirming will permanently retire{' '}
          <strong>{summary.amount.toLocaleString()} tCO₂</strong> on-chain. The
          credits cannot be recovered, resold, or transferred afterwards.
        </div>
      </div>

      <ReviewSection title="Credit">
        <ReviewRow label="Project" value={summary.creditProjectName} />
        {summary.creditCountry && (
          <ReviewRow label="Country" value={summary.creditCountry} />
        )}
        <ReviewRow label="Credit ID" value={summary.creditId} mono />
        <ReviewRow
          label="Amount"
          value={`${summary.amount.toLocaleString()} tCO₂`}
          emphasis
        />
        {summary.estimatedValue != null && (
          <ReviewRow
            label="Estimated value"
            value={`$${summary.estimatedValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
          />
        )}
      </ReviewSection>

      <ReviewSection title="Purpose">
        <ReviewRow label="Purpose" value={summary.purposeLabel} />
        <ReviewRow
          label="Purpose details"
          value={summary.purposeDetails?.trim() || 'Not provided'}
          muted={!summary.purposeDetails?.trim()}
        />
      </ReviewSection>

      <ReviewSection title="Wallet & Beneficiary" icon={Wallet}>
        <ReviewRow label="Beneficiary" value={summary.beneficiaryName} />
        <ReviewRow label="Wallet" value={summary.beneficiaryWallet} mono />
      </ReviewSection>

      <ReviewSection title="Reporting Impact" icon={BarChart3}>
        <ReviewRow
          label="Counts toward"
          value={summary.reportingFrameworkLabel}
        />
        <ReviewRow
          label="Reporting period"
          value={summary.reportingPeriod?.trim() || 'Not specified'}
          muted={!summary.reportingPeriod?.trim()}
        />
        <ReviewRow
          label="Reported as"
          value={`${summary.amount.toLocaleString()} tCO₂ offset under ${summary.purposeLabel}`}
        />
      </ReviewSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={retiring}
          className="corporate-btn-secondary py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back &amp; Edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={retiring}
          className="corporate-btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label={
            retiring
              ? 'Processing retirement...'
              : `Confirm retirement of ${summary.amount.toLocaleString()} tons of carbon credits`
          }
        >
          {retiring ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Processing Retirement…
            </>
          ) : (
            <>
              <Shield size={18} aria-hidden="true" />
              Confirm Retirement
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <h4 className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {title}
      </h4>
      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        {children}
      </dl>
    </section>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
  emphasis = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd
        className={[
          'text-right break-all',
          mono ? 'font-mono text-xs' : '',
          emphasis
            ? 'font-bold text-corporate-blue'
            : muted
              ? 'text-gray-400 dark:text-gray-500 italic'
              : 'font-medium text-gray-900 dark:text-white',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}
