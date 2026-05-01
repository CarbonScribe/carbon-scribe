'use client';

import { AlertCircle, CheckCircle, RefreshCw, TrendingUp } from 'lucide-react';
import type { CsrdReadiness } from '@/types/csrd';

interface Props {
  readiness: CsrdReadiness | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}

const SCORE_COLOR = (score: number): string => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const BAR_COLOR = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

export function CSRDReadinessCard({ readiness, loading, error, onRefresh }: Props) {
  return (
    <div className="corporate-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            CSRD Readiness Scorecard
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Disclosure coverage across ESRS standards
          </p>
        </div>
        <div className="flex items-center gap-3">
          {readiness && (
            <div className={`text-3xl font-bold ${SCORE_COLOR(readiness.overall)}`}>
              {readiness.overall}%
            </div>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-corporate-blue disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && !readiness && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="space-y-1.5">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24 animate-pulse" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {readiness && (
        <>
          {/* Overall progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-medium text-gray-900 dark:text-white">Overall Coverage</span>
              <span className={`font-bold ${SCORE_COLOR(readiness.overall)}`}>
                {readiness.overall}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${BAR_COLOR(readiness.overall)}`}
                style={{ width: `${readiness.overall}%` }}
              />
            </div>
          </div>

          {/* Per-standard breakdown */}
          {Object.keys(readiness.byStandard).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Coverage by Standard
              </h4>
              <div className="space-y-2.5">
                {Object.entries(readiness.byStandard).map(([std, score]) => (
                  <div key={std}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{std}</span>
                      <span className={SCORE_COLOR(score)}>{score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${BAR_COLOR(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing disclosures */}
          {readiness.missingDisclosures.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-yellow-500" />
                Missing Disclosures ({readiness.missingDisclosures.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {readiness.missingDisclosures.map((d) => (
                  <span
                    key={d}
                    className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-medium"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {readiness.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-corporate-blue" />
                Recommendations
              </h4>
              <ul className="space-y-1.5">
                {readiness.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle
                      size={14}
                      className="text-corporate-blue shrink-0 mt-0.5"
                    />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
