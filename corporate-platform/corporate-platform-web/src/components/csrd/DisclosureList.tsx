'use client';

import { useState } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Shield,
} from 'lucide-react';
import type {
  Disclosure,
  RecordDisclosurePayload,
  DisclosureQuery,
  EsrsStandard,
  AssuranceLevel,
} from '@/types/csrd';

const ESRS_STANDARDS: EsrsStandard[] = [
  'ESRS E1', 'ESRS E2', 'ESRS E3', 'ESRS E4', 'ESRS E5',
  'ESRS S1', 'ESRS S2', 'ESRS S3', 'ESRS S4',
  'ESRS G1',
];

const ASSURANCE_COLORS: Record<AssuranceLevel, string> = {
  LIMITED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  REASONABLE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

interface RecordFormProps {
  onSubmit: (payload: RecordDisclosurePayload) => Promise<Disclosure | null>;
  recording: boolean;
  recordError: string | null;
  onClearError: () => void;
  onClose: () => void;
}

function RecordDisclosureModal({
  onSubmit,
  recording,
  recordError,
  onClearError,
  onClose,
}: RecordFormProps) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState<RecordDisclosurePayload>({
    reportingPeriod: String(currentYear),
    standard: 'ESRS E1',
    disclosureRequirement: '',
    dataPoint: '',
    value: '',
    assuranceLevel: undefined,
  });
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onClearError();
    const result = await onSubmit(form);
    if (result) setSuccess(true);
  }

  if (success) {
    return (
      <div className="p-6 text-center space-y-3">
        <CheckCircle className="mx-auto text-green-500" size={40} />
        <p className="font-medium text-gray-900 dark:text-white">Disclosure recorded</p>
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setForm({
              reportingPeriod: String(currentYear),
              standard: 'ESRS E1',
              disclosureRequirement: '',
              dataPoint: '',
              value: '',
              assuranceLevel: undefined,
            });
          }}
          className="corporate-btn-secondary px-4 py-2 text-sm"
        >
          Record Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {recordError && (
        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{recordError}</p>
          <button type="button" onClick={onClearError}>
            <X size={14} className="text-red-400" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Reporting Period
          </label>
          <input
            type="text"
            value={form.reportingPeriod}
            onChange={(e) => setForm({ ...form, reportingPeriod: e.target.value })}
            placeholder="e.g. 2024"
            required
            className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            ESRS Standard
          </label>
          <select
            value={form.standard}
            onChange={(e) => setForm({ ...form, standard: e.target.value as EsrsStandard })}
            className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          >
            {ESRS_STANDARDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Disclosure Requirement
          </label>
          <input
            type="text"
            value={form.disclosureRequirement}
            onChange={(e) => setForm({ ...form, disclosureRequirement: e.target.value })}
            placeholder="e.g. E1-6"
            required
            className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
            Data Point
          </label>
          <input
            type="text"
            value={form.dataPoint}
            onChange={(e) => setForm({ ...form, dataPoint: e.target.value })}
            placeholder="e.g. Scope 1 Emissions (tCO₂e)"
            required
            className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Value
        </label>
        <input
          type="text"
          value={String(form.value)}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          placeholder="Numeric or text value"
          required
          className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
          Assurance Level (optional)
        </label>
        <select
          value={form.assuranceLevel ?? ''}
          onChange={(e) =>
            setForm({
              ...form,
              assuranceLevel: (e.target.value as AssuranceLevel) || undefined,
            })
          }
          className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
        >
          <option value="">None</option>
          <option value="LIMITED">Limited</option>
          <option value="REASONABLE">Reasonable</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="corporate-btn-secondary px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={recording}
          className="corporate-btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {recording ? (
            <>
              <Loader2 size={14} className="mr-1.5 animate-spin" /> Saving…
            </>
          ) : (
            'Record Disclosure'
          )}
        </button>
      </div>
    </form>
  );
}

interface Props {
  disclosures: Disclosure[];
  loading: boolean;
  error: string | null;
  recording: boolean;
  recordError: string | null;
  onFetch: (query?: DisclosureQuery) => Promise<void>;
  onRecord: (payload: RecordDisclosurePayload) => Promise<Disclosure | null>;
  onClearRecordError: () => void;
}

export function DisclosureList({
  disclosures,
  loading,
  error,
  recording,
  recordError,
  onFetch,
  onRecord,
  onClearRecordError,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [standardFilter, setStandardFilter] =
    useState<EsrsStandard | ''>('');

  const handleFilterChange = async (std: EsrsStandard | '') => {
    setStandardFilter(std);
    await onFetch(std ? { standard: std } : {});
  };

  const filteredDisclosures = standardFilter
    ? disclosures.filter((d) => d.standard === standardFilter)
    : disclosures;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">Filter by standard:</label>
          <select
            value={standardFilter}
            onChange={(e) => handleFilterChange(e.target.value as EsrsStandard | '')}
            className="p-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-corporate-blue"
          >
            <option value="">All Standards</option>
            {ESRS_STANDARDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center corporate-btn-primary px-4 py-2 text-sm"
        >
          <Plus size={16} className="mr-1.5" />
          Record Disclosure
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-white">Record ESRS Disclosure</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <RecordDisclosureModal
                onSubmit={onRecord}
                recording={recording}
                recordError={recordError}
                onClearError={onClearRecordError}
                onClose={() => setShowModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && filteredDisclosures.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Standard', 'Requirement', 'Data Point', 'Period', 'Value', 'Assurance'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredDisclosures.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-corporate-blue whitespace-nowrap">
                    {d.standard}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {d.disclosureRequirement}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-40 truncate">
                    {d.dataPoint}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {d.reportingPeriod}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-32 truncate">
                    {String(d.value)}
                  </td>
                  <td className="px-4 py-3">
                    {d.assuranceLevel ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ASSURANCE_COLORS[d.assuranceLevel]}`}
                      >
                        <Shield size={10} />
                        {d.assuranceLevel}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filteredDisclosures.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Shield className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-medium">No disclosures recorded yet</p>
          <p className="text-sm mt-1">Click &quot;Record Disclosure&quot; to add your first ESRS data point.</p>
        </div>
      )}
    </div>
  );
}
