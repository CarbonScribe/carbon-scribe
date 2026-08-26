'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Building,
  Zap,
  Globe,
  Target,
  Calendar,
  Calculator,
  Shield,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  FileText,
  X,
} from 'lucide-react';
import { useRetirement } from '@/hooks/useRetirement';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useAnnouncement } from '@/hooks/useAnnouncement';
import { IconButton } from '@/components/common/IconButton';
import { AccessibleIcon } from '@/components/common/AccessibleIcon';
import RetirementReviewStep from '@/components/retirement/RetirementReviewStep';
import type {
  ReportingFramework,
  RetirementPurpose,
  RetirementRecord,
  RetirementReviewSummary,
} from '@/types/retirement';

interface AvailableCredit {
  id: string;
  projectName: string;
  country?: string;
  pricePerTon?: number;
  availableAmount?: number;
}

interface InstantRetirementFormProps {
  /** Called after a successful retirement with the resulting record. */
  onSuccess?: (retirement: RetirementRecord) => void;
  /** Optional list of available credits to show as selectable options. */
  availableCredits?: AvailableCredit[];
  /** Whether the form is in a modal */
  isModal?: boolean;
  /** Whether the modal is open */
  isOpen?: boolean;
  /** Callback to close the modal */
  onClose?: () => void;
  /**
   * Company the retirement is attributed to. Shown on the review step so the
   * user can confirm the beneficiary before committing (#512).
   */
  companyName?: string;
  /** Company wallet the retirement executes from. */
  companyWallet?: string;
}

const PURPOSES: {
  id: RetirementPurpose;
  name: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'scope1',
    name: 'Scope 1 Emissions',
    description: 'Direct emissions from owned sources',
    icon: Building,
  },
  {
    id: 'scope2',
    name: 'Scope 2 Emissions',
    description: 'Indirect emissions from purchased energy',
    icon: Zap,
  },
  {
    id: 'scope3',
    name: 'Scope 3 Emissions',
    description: 'Other indirect emissions in value chain',
    icon: Globe,
  },
  {
    id: 'corporate',
    name: 'Corporate Travel',
    description: 'Business travel carbon footprint',
    icon: Target,
  },
  {
    id: 'events',
    name: 'Events & Conferences',
    description: 'Carbon footprint of corporate events',
    icon: Calendar,
  },
  {
    id: 'product',
    name: 'Product Carbon',
    description: 'Carbon footprint of products sold',
    icon: Calculator,
  },
];

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];

/**
 * Reporting frameworks a retirement can be attributed to, surfaced so the
 * review step can state which report the retirement will count toward (#512).
 */
const REPORTING_FRAMEWORKS: { id: ReportingFramework; name: string }[] = [
  { id: 'ghg-protocol', name: 'GHG Protocol Corporate Standard' },
  { id: 'csrd', name: 'CSRD / ESRS E1' },
  { id: 'cdp', name: 'CDP Climate Change' },
  { id: 'sbti', name: 'Science Based Targets (SBTi)' },
  { id: 'corsia', name: 'CORSIA' },
  { id: 'cbam', name: 'CBAM' },
  { id: 'none', name: 'Not attributed to a framework' },
];

/** Which screen of the flow is showing. The three input steps are unchanged. */
type FormStage = 'form' | 'review';

export default function InstantRetirementForm({
  onSuccess,
  availableCredits = [],
  isModal = false,
  isOpen = true,
  onClose = () => {},
  companyName,
  companyWallet,
}: InstantRetirementFormProps) {
  const { retire, retiring, retireError, lastRetirement, clearRetireError, clearLastRetirement } =
    useRetirement();
  const { labels } = useAccessibility();
  const { announce } = useAnnouncement();

  const [purpose, setPurpose] = useState<RetirementPurpose>('scope1');
  const [purposeDetails, setPurposeDetails] = useState('');
  const [selectedCreditId, setSelectedCreditId] = useState(
    availableCredits[0]?.id ?? '',
  );
  const [manualCreditId, setManualCreditId] = useState('');
  const [amount, setAmount] = useState(1000);
  const [submitted, setSubmitted] = useState(false);
  /**
   * `form` shows the three-step input flow; `review` shows the pre-commit
   * summary. Submitting the form advances the stage — it never calls the API
   * directly (#512).
   */
  const [stage, setStage] = useState<FormStage>('form');
  const [beneficiaryName, setBeneficiaryName] = useState(companyName ?? '');
  const [beneficiaryWallet, setBeneficiaryWallet] = useState(
    companyWallet ?? '',
  );
  const [reportingFramework, setReportingFramework] =
    useState<ReportingFramework>('ghg-protocol');
  const [reportingPeriod, setReportingPeriod] = useState('');

  // Refs for focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const creditId = availableCredits.length > 0 ? selectedCreditId : manualCreditId.trim();
  const selectedCredit = availableCredits.find((c) => c.id === selectedCreditId);
  const maxAmount = selectedCredit?.availableAmount ?? 10000;
  const canSubmit = creditId.length > 0 && amount >= 1 && !retiring;

  // Focus management for modal
  useEffect(() => {
    if (!isModal || !isOpen) return;

    // Store the currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the container or title
    const focusTarget = titleRef.current || containerRef.current;
    if (focusTarget) {
      setTimeout(() => {
        focusTarget.focus();
      }, 100);
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isModal, isOpen]);

  // Focus trap for modal
  useEffect(() => {
    if (!isModal || !isOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleTabKey);
    return () => window.removeEventListener('keydown', handleTabKey);
  }, [isModal, isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isModal || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, isOpen, onClose]);

  // Focus title on success
  useEffect(() => {
    if (submitted && lastRetirement && successTitleRef.current) {
      setTimeout(() => {
        successTitleRef.current?.focus();
      }, 100);
      announce('Retirement successful', 'assertive');
    }
  }, [submitted, lastRetirement, announce]);

  // Focus error message
  useEffect(() => {
    if (retireError && errorRef.current) {
      setTimeout(() => {
        errorRef.current?.focus();
      }, 100);
      announce(`Retirement error: ${retireError}`, 'assertive');
    }
  }, [retireError, announce]);

  /**
   * The summary shown on the review step. Combines the form inputs with
   * context the user never typed (project name, price, company wallet) so the
   * screen describes the actual effect of confirming, not just the raw inputs.
   */
  const reviewSummary: RetirementReviewSummary = {
    creditId,
    creditProjectName: selectedCredit?.projectName ?? creditId,
    creditCountry: selectedCredit?.country,
    pricePerTon: selectedCredit?.pricePerTon,
    amount,
    estimatedValue:
      selectedCredit?.pricePerTon != null
        ? selectedCredit.pricePerTon * amount
        : undefined,
    purpose,
    purposeLabel: PURPOSES.find((p) => p.id === purpose)?.name ?? purpose,
    purposeDetails: purposeDetails.trim() || undefined,
    beneficiaryName:
      beneficiaryName.trim() || companyName?.trim() || 'Your company',
    beneficiaryWallet:
      beneficiaryWallet.trim() ||
      companyWallet?.trim() ||
      'Company wallet on file',
    reportingFramework,
    reportingFrameworkLabel:
      REPORTING_FRAMEWORKS.find((f) => f.id === reportingFramework)?.name ??
      reportingFramework,
    reportingPeriod: reportingPeriod.trim() || undefined,
  };

  /**
   * Submitting the form opens the review step. It deliberately does NOT call
   * retire() — retirement is irreversible, so the API call only happens from
   * the explicit confirm action on the review screen (#512).
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || retiring) return;

    setStage('review');
    announce(
      'Review your retirement details before confirming. This action is permanent.',
      'assertive',
    );
  }

  /** Return to the form with every value intact. Nothing has been retired. */
  function handleBackToForm() {
    setStage('form');
    announce('Returned to the retirement form. Nothing has been retired.', 'polite');
  }

  /** The only path that actually commits the retirement. */
  async function handleConfirmRetirement() {
    if (!canSubmit || retiring) return;

    const result = await retire({
      creditId,
      amount,
      purpose,
      purposeDetails: purposeDetails.trim() || undefined,
      beneficiaryName: reviewSummary.beneficiaryName,
      beneficiaryWallet: beneficiaryWallet.trim() || companyWallet || undefined,
      reportingFramework,
      reportingPeriod: reportingPeriod.trim() || undefined,
    });

    if (result) {
      setSubmitted(true);
      onSuccess?.(result);
      announce(`Successfully retired ${amount} tons of carbon credits`, 'assertive');
    } else {
      // Keep the user on the review step so the error is shown next to the
      // action that produced it and they can retry or go back and edit.
      setStage('review');
    }
  }

  function handleReset() {
    setSubmitted(false);
    setStage('form');
    clearLastRetirement();
    clearRetireError();
    setPurposeDetails('');
    setAmount(1000);
    setReportingPeriod('');
    announce('Form reset', 'polite');
  }

  function handleClose() {
    clearRetireError();
    clearLastRetirement();
    setSubmitted(false);
    setStage('form');
    onClose();
  }

  const getTitleId = 'retirement-form-title';
  const getDescId = 'retirement-form-desc';

  // ── Success State ──────────────────────────────────────────────────────────
  if (submitted && lastRetirement) {
    return (
      <div
        ref={containerRef}
        className="corporate-card p-6 focus:outline-none"
        role={isModal ? 'dialog' : undefined}
        aria-modal={isModal ? 'true' : undefined}
        aria-labelledby={getTitleId}
        tabIndex={isModal ? -1 : undefined}
      >
        {isModal && (
          <IconButton
            ref={closeButtonRef}
            label={labels.closeCart}
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <AccessibleIcon hidden aria-hidden="true">
              <X size={20} />
            </AccessibleIcon>
          </IconButton>
        )}

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2
            ref={successTitleRef}
            id={getTitleId}
            tabIndex={-1}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-1 focus:outline-none"
          >
            Retirement Successful
          </h2>
          <p id={getDescId} className="text-gray-600 dark:text-gray-400">
            Your carbon credits have been permanently retired on-chain.
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Certificate Number</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white">
              {lastRetirement.certificateId ?? `RET-${lastRetirement.id.slice(-6).toUpperCase()}`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Amount Retired</span>
            <span className="font-bold text-corporate-blue">
              {lastRetirement.amount.toLocaleString()} tCO₂
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Purpose</span>
            <span className="font-medium text-gray-900 dark:text-white capitalize">
              {PURPOSES.find((p) => p.id === lastRetirement.purpose)?.name ?? lastRetirement.purpose}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Date</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {new Date(lastRetirement.retiredAt).toLocaleDateString()}
            </span>
          </div>
          {lastRetirement.transactionHash && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Transaction</span>
              <a
                href={`https://stellar.expert/explorer/public/tx/${lastRetirement.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-corporate-blue hover:text-corporate-blue/80 flex items-center gap-1"
                aria-label="View transaction on Stellar Explorer"
              >
                {lastRetirement.transactionHash.slice(0, 12)}…
                <AccessibleIcon hidden aria-hidden="true">
                  <ExternalLink size={10} />
                </AccessibleIcon>
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`/api/v1/retirements/${lastRetirement.id}/certificate`}
            target="_blank"
            rel="noopener noreferrer"
            className="corporate-btn-secondary text-sm px-4 py-2.5 flex items-center justify-center gap-2"
            aria-label="Download retirement certificate"
          >
            <AccessibleIcon hidden aria-hidden="true">
              <FileText size={16} />
            </AccessibleIcon>
            Download Certificate
          </a>
          <button
            onClick={handleReset}
            className="corporate-btn-primary text-sm px-4 py-2.5"
          >
            Retire More Credits
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const formContent = (
    <div
      ref={containerRef}
      tabIndex={isModal ? -1 : undefined}
      role={isModal ? 'dialog' : undefined}
      aria-modal={isModal ? 'true' : undefined}
      aria-labelledby={getTitleId}
      aria-describedby={getDescId}
      className="corporate-card p-6 focus:outline-none relative"
    >
      {isModal && (
        <IconButton
          ref={closeButtonRef}
          label={labels.closeCart}
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <AccessibleIcon hidden aria-hidden="true">
            <X size={20} />
          </AccessibleIcon>
        </IconButton>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id={getTitleId} className="text-xl font-bold text-gray-900 dark:text-white">
            Instant Retirement
          </h2>
          <p id={getDescId} className="text-sm text-gray-600 dark:text-gray-400">
            Retire credits with on-chain verification
          </p>
        </div>
        <AccessibleIcon hidden aria-hidden="true">
          <Zap className="text-corporate-blue" size={24} />
        </AccessibleIcon>
      </div>

      {/* Error Banner — rendered on both the form and the review step so a
          failed confirmation is reported next to the action that produced it. */}
      {retireError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="flex items-start gap-3 p-4 mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl focus:outline-none"
          role="alert"
          aria-live="assertive"
        >
          <AccessibleIcon hidden aria-hidden="true">
            <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          </AccessibleIcon>
          <div className="flex-1 text-sm text-red-800 dark:text-red-300">{retireError}</div>
          <button
            type="button"
            onClick={clearRetireError}
            className="text-red-500 hover:text-red-700 dark:text-red-400 text-xs underline shrink-0"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Pre-commit review step (#512) ──────────────────────────────────
          Shown instead of the form once the user submits. The retirement API
          is only called from the explicit confirm action here. */}
      {stage === 'review' && (
        <RetirementReviewStep
          summary={reviewSummary}
          onBack={handleBackToForm}
          onConfirm={handleConfirmRetirement}
          retiring={retiring}
        />
      )}

      {/* The three input steps are unchanged; all values live in component
          state, so returning from the review step restores them intact. */}
      {stage === 'form' && (
      <form onSubmit={handleSubmit} noValidate>
        {/* Step 1 – Purpose */}
        <fieldset className="mb-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            1. Retirement Purpose
          </legend>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" role="radiogroup" aria-label="Retirement purpose">
            {PURPOSES.map(({ id, name, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPurpose(id);
                  announce(`Selected ${name}`, 'polite');
                }}
                role="radio"
                aria-checked={purpose === id}
                className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                  purpose === id
                    ? 'border-corporate-blue bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-corporate-blue/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0" aria-hidden="true">
                    <Icon size={16} className="text-corporate-blue" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
                      {name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                      {description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <label htmlFor="purpose-details" className="sr-only">
              Purpose details
            </label>
            <input
              id="purpose-details"
              type="text"
              placeholder="Optional: add purpose details (e.g. Q1 2026 reporting)"
              value={purposeDetails}
              onChange={(e) => setPurposeDetails(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            />
          </div>
        </fieldset>

        {/* Step 2 – Credit Selection */}
        <fieldset className="mb-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            2. Select Credit
          </legend>
          {availableCredits.length > 0 ? (
            <div className="space-y-2" role="radiogroup" aria-label="Available credits">
              {availableCredits.map((credit) => (
                <button
                  key={credit.id}
                  type="button"
                  onClick={() => {
                    setSelectedCreditId(credit.id);
                    announce(`Selected ${credit.projectName}`, 'polite');
                  }}
                  role="radio"
                  aria-checked={selectedCreditId === credit.id}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 ${
                    selectedCreditId === credit.id
                      ? 'border-corporate-blue bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-corporate-blue/50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                      {credit.projectName}
                    </div>
                    {credit.country && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {credit.country}
                        {credit.pricePerTon != null && ` · $${credit.pricePerTon}/ton`}
                      </div>
                    )}
                  </div>
                  {credit.availableAmount != null && (
                    <div className="text-right text-sm">
                      <div className="font-bold text-gray-900 dark:text-white">
                        {credit.availableAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">tCO₂ avail.</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label htmlFor="manual-credit-id" className="sr-only">
                Enter Credit ID
              </label>
              <input
                id="manual-credit-id"
                type="text"
                placeholder="Enter Credit ID"
                value={manualCreditId}
                onChange={(e) => setManualCreditId(e.target.value)}
                required
                aria-required="true"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
              />
            </div>
          )}
        </fieldset>

        {/* Step 3 – Amount */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="amount-range" className="text-sm font-medium text-gray-900 dark:text-white">
              3. Amount to Retire
            </label>
            <span className="text-corporate-blue font-bold" aria-live="polite">
              {amount.toLocaleString()} tCO₂
            </span>
          </div>
          <input
            id="amount-range"
            type="range"
            min={1}
            max={maxAmount}
            step={100}
            value={Math.min(amount, maxAmount)}
            onChange={(e) => setAmount(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mb-3"
            aria-valuenow={amount}
            aria-valuemin={1}
            aria-valuemax={maxAmount}
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.filter((a) => a <= maxAmount).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAmount(a);
                  announce(`Selected ${a.toLocaleString()} tons`, 'polite');
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  amount === a
                    ? 'bg-corporate-blue text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                aria-label={`Set amount to ${a.toLocaleString()} tons`}
              >
                {a.toLocaleString()}
              </button>
            ))}
            <div className="relative">
              <label htmlFor="custom-amount" className="sr-only">
                Custom amount
              </label>
              <input
                id="custom-amount"
                type="number"
                min={1}
                max={maxAmount}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-24 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
                aria-label="Custom amount in tons"
              />
            </div>
          </div>
        </div>

        {/* Attribution — wallet/beneficiary and reporting impact. Additive to
            the three-step flow above; every field is optional and defaults to
            the authenticated company's context. Surfaced here so the review
            step has real values to summarise (#512). */}
        <fieldset className="mb-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Attribution &amp; Reporting{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">
              (optional)
            </span>
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="beneficiary-name"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                Beneficiary
              </label>
              <input
                id="beneficiary-name"
                type="text"
                placeholder={companyName ?? 'Your company'}
                value={beneficiaryName}
                onChange={(e) => setBeneficiaryName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
              />
            </div>
            <div>
              <label
                htmlFor="beneficiary-wallet"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                Wallet
              </label>
              <input
                id="beneficiary-wallet"
                type="text"
                placeholder={companyWallet ?? 'Company wallet on file'}
                value={beneficiaryWallet}
                onChange={(e) => setBeneficiaryWallet(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
              />
            </div>
            <div>
              <label
                htmlFor="reporting-framework"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                Reporting framework
              </label>
              <select
                id="reporting-framework"
                value={reportingFramework}
                onChange={(e) =>
                  setReportingFramework(e.target.value as ReportingFramework)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
              >
                {REPORTING_FRAMEWORKS.map((framework) => (
                  <option key={framework.id} value={framework.id}>
                    {framework.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="reporting-period"
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                Reporting period
              </label>
              <input
                id="reporting-period"
                type="text"
                placeholder="e.g. FY2026 Q1"
                value={reportingPeriod}
                onChange={(e) => setReportingPeriod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
              />
            </div>
          </div>
        </fieldset>

        {/* Submit — opens the review step; it does not retire anything. */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full corporate-btn-primary py-4 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label={`Review retirement of ${amount.toLocaleString()} tons of carbon credits before confirming`}
        >
          <AccessibleIcon hidden aria-hidden="true">
            <Shield size={20} />
          </AccessibleIcon>
          Review &amp; Retire {amount.toLocaleString()} tCO₂
        </button>

        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle size={15} className="shrink-0" aria-hidden="true" />
            Instant on-chain verification · Immutable certificate · Real-time reporting
          </div>
        </div>
      </form>
      )}
    </div>
  );

  // ── Modal Wrapper ─────────────────────────────────────────────────────────
  if (isModal) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        {formContent}
      </div>
    );
  }

  return formContent;
}