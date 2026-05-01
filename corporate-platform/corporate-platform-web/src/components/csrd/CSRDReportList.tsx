'use client';

import { useState } from 'react';
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import type { CsrdReport } from '@/types/csrd';

const STATUS_COLORS: Record<string, string> = {
  REVIEW: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  DRAFT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

interface Props {
  reports: CsrdReport[];
  loading: boolean;
  error: string | null;
  generating: boolean;
  generateError: string | null;
  lastGeneratedReport: CsrdReport | null;
  onGenerate: (year: number) => Promise<CsrdReport | null>;
  onFetchReports: () => Promise<void>;
  onClearGenerateError: () => void;
}

export function CSRDReportList({
  reports,
  loading,
  error,
  generating,
  generateError,
  lastGeneratedReport,
  onGenerate,
  onFetchReports,
  onClearGenerateError,
}: Props) {
  const currentYear = new Date().getFullYear();
  const [yearInput, setYearInput] = useState(currentYear);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    onClearGenerateError();
    await onGenerate(yearInput);
  }

  const statusColor = (status: string) =>
    STATUS_COLORS[status.toUpperCase()] ??
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Generate Panel */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Generate CSRD Report
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Compile all ESRS disclosures into a structured report
            </p>
          </div>
          <FileText className="text-corporate-blue" size={24} />
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          {generateError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="flex-1">{generateError}</span>
              <button type="button" onClick={onClearGenerateError} className="text-red-400">
                ×
              </button>
            </div>
          )}

          {lastGeneratedReport && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
              <CheckCircle size={16} />
              Report for {lastGeneratedReport.reportingYear} created — status:{' '}
              <span className="font-medium">{lastGeneratedReport.status}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Reporting Year
            </label>
            <input
              type="number"
              min={2020}
              max={currentYear}
              value={yearInput}
              onChange={(e) => setYearInput(Number(e.target.value))}
              className="w-32 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
            />
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full corporate-btn-primary py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileText size={18} className="mr-2" />
                Generate Report
              </>
            )}
          </button>
        </form>
      </div>

      {/* Report List Panel */}
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Report Archive
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {reports.length} report{reports.length !== 1 ? 's' : ''} generated
            </p>
          </div>
          <button
            type="button"
            onClick={onFetchReports}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-corporate-blue transition-colors disabled:opacity-40"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300 mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            <FileText className="mx-auto mb-3 opacity-30" size={36} />
            <p className="text-sm">No CSRD reports yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    CSRD Report {report.reportingYear}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {report.metadata?.totalDisclosures ?? 0} disclosures ·{' '}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(report.status)}`}
                  >
                    {report.status}
                  </span>
                  {report.reportUrl && (
                    <a
                      href={report.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-corporate-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Download size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
