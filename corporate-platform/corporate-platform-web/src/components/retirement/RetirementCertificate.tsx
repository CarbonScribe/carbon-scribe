'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  CheckCircle,
  ExternalLink,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { retirementService } from '@/services/retirement.service';
import type { RetirementRecord } from '@/types/retirement';

interface RetirementCertificateProps {
  /** ID of the retirement to display. Pass null/undefined to show placeholder. */
  retirementId?: string | null;
}

export default function RetirementCertificate({
  retirementId,
}: RetirementCertificateProps) {
  const [record, setRecord] = useState<RetirementRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!retirementId) {
      setRecord(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    retirementService.getById(retirementId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) {
        setRecord(res.data);
      } else {
        setError(res.error ?? 'Failed to load certificate');
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [retirementId]);

  async function handleDownload() {
    if (!record) return;
    const url = retirementService.getCertificateDownloadUrl(record.id);
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `certificate-${record.certificateId ?? record.id}.pdf`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Certificate
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Most recent retirement proof
            </p>
          </div>
          <FileText className="text-corporate-blue" size={20} />
        </div>
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Certificate
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Most recent retirement proof
            </p>
          </div>
          <FileText className="text-corporate-blue" size={20} />
        </div>
        <div
          className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
          role="alert"
        >
          <AlertCircle
            size={18}
            className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
          />
          <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
        </div>
      </div>
    );
  }

  // ── Placeholder (no retirement selected yet) ───────────────────────────────
  if (!record) {
    return (
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Latest Certificate
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Most recent retirement proof
            </p>
          </div>
          <FileText className="text-corporate-blue" size={20} />
        </div>
        <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-600">
          <FileText size={40} className="mb-3 opacity-40" />
          <p className="text-sm">Retire credits to generate a certificate</p>
        </div>
      </div>
    );
  }

  // ── Certificate ────────────────────────────────────────────────────────────
  const certNumber =
    record.certificateId ?? `RET-${record.id.slice(-6).toUpperCase()}`;

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Latest Certificate
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Most recent retirement proof
          </p>
        </div>
        <FileText className="text-corporate-blue" size={20} />
      </div>

      <div className="bg-linear-to-br from-blue-500/10 to-teal-500/10 rounded-xl p-4 mb-4">
        <div className="text-center mb-3">
          <CheckCircle
            size={48}
            className="text-green-500 mx-auto mb-2"
          />
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            Retirement Verified
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Certificate #{certNumber}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Date</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {new Date(record.retiredAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Amount</span>
            <span className="font-bold text-corporate-blue">
              {record.amount.toLocaleString()} tCO₂
            </span>
          </div>
          {record.credit?.projectName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Project</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {record.credit.projectName}
              </span>
            </div>
          )}
          {record.transactionHash && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Transaction
              </span>
              <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                {record.transactionHash.slice(0, 12)}…
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleDownload}
          className="corporate-btn-secondary text-sm px-3 py-2 flex items-center justify-center gap-1.5"
        >
          <Download size={14} />
          PDF
        </button>
        {record.transactionHash && (
          <a
            href={`https://stellar.expert/explorer/public/tx/${record.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="corporate-btn-primary text-sm px-3 py-2 flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} />
            View on-chain
          </a>
        )}
      </div>
    </div>
  );
}
