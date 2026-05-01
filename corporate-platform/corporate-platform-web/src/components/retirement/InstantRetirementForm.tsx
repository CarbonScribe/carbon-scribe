'use client';

import { useState } from 'react';
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
  Loader2,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useRetirement } from '@/hooks/useRetirement';
import type { RetirementPurpose, RetirementRecord } from '@/types/retirement';

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

export default function InstantRetirementForm({
  onSuccess,
  availableCredits = [],
}: InstantRetirementFormProps) {
  const { retire, retiring, retireError, lastRetirement, clearRetireError, clearLastRetirement } =
    useRetirement();

  const [purpose, setPurpose] = useState<RetirementPurpose>('scope1');
  const [purposeDetails, setPurposeDetails] = useState('');
  const [selectedCreditId, setSelectedCreditId] = useState(
    availableCredits[0]?.id ?? '',
  );
  const [manualCreditId, setManualCreditId] = useState('');
  const [amount, setAmount] = useState(1000);
  const [submitted, setSubmitted] = useState(false);

  const creditId = availableCredits.length > 0 ? selectedCreditId : manualCreditId.trim();
  const selectedCredit = availableCredits.find((c) => c.id === selectedCreditId);
  const maxAmount = selectedCredit?.availableAmount ?? 10000;
  const canSubmit = creditId.length > 0 && amount >= 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const result = await retire({
      creditId,
      amount,
      purpose,
      purposeDetails: purposeDetails.trim() || undefined,
    });

    if (result) {
      setSubmitted(true);
      onSuccess?.(result);
    }
  }

  function handleReset() {
    setSubmitted(false);
    clearLastRetirement();
    clearRetireError();
    setPurposeDetails('');
    setAmount(1000);
  }

  // ── Success State ──────────────────────────────────────────────────────────
  if (submitted && lastRetirement) {
    return (
      <div className="corporate-card p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Retirement Successful
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
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
              >
                {lastRetirement.transactionHash.slice(0, 12)}…
                <ExternalLink size={10} />
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
          >
            <FileText size={16} />
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
  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Instant Retirement
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Retire credits with on-chain verification
          </p>
        </div>
        <Zap className="text-corporate-blue" size={24} />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Error Banner */}
        {retireError && (
          <div className="flex items-start gap-3 p-4 mb-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl" role="alert">
            <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-800 dark:text-red-300">{retireError}</div>
            <button
              type="button"
              onClick={clearRetireError}
              className="text-red-500 hover:text-red-700 dark:text-red-400 text-xs underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1 – Purpose */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            1. Retirement Purpose
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PURPOSES.map(({ id, name, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPurpose(id)}
                className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                  purpose === id
                    ? 'border-corporate-blue bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-corporate-blue/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
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
          <input
            type="text"
            placeholder="Optional: add purpose details (e.g. Q1 2026 reporting)"
            value={purposeDetails}
            onChange={(e) => setPurposeDetails(e.target.value)}
            className="mt-3 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          />
        </div>

        {/* Step 2 – Credit Selection */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            2. Select Credit
          </div>
          {availableCredits.length > 0 ? (
            <div className="space-y-2">
              {availableCredits.map((credit) => (
                <button
                  key={credit.id}
                  type="button"
                  onClick={() => setSelectedCreditId(credit.id)}
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
            <input
              type="text"
              placeholder="Enter Credit ID"
              value={manualCreditId}
              onChange={(e) => setManualCreditId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            />
          )}
        </div>

        {/* Step 3 – Amount */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              3. Amount to Retire
            </div>
            <div className="text-corporate-blue font-bold">
              {amount.toLocaleString()} tCO₂
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={maxAmount}
            step={100}
            value={Math.min(amount, maxAmount)}
            onChange={(e) => setAmount(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.filter((a) => a <= maxAmount).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  amount === a
                    ? 'bg-corporate-blue text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {a.toLocaleString()}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-24 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || retiring}
          className="w-full corporate-btn-primary py-4 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {retiring ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Processing Retirement…
            </>
          ) : (
            <>
              <Shield size={20} />
              Retire {amount.toLocaleString()} tCO₂ Now
            </>
          )}
        </button>

        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle size={15} className="shrink-0" />
            Instant on-chain verification · Immutable certificate · Real-time reporting
          </div>
        </div>
      </form>
    </div>
  );
}
