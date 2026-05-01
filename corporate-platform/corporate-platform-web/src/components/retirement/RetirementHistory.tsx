'use client'

import { useEffect, useState } from 'react'
import {
  ExternalLink,
  FileText,
  CheckCircle,
  Globe,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { retirementService } from '@/services/retirement.service'
import type { RetirementRecord, RetirementHistoryQuery } from '@/types/retirement'

const PAGE_SIZE = 10

export default function RetirementHistory() {
  const [records, setRecords] = useState<RetirementRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  async function load(query: RetirementHistoryQuery) {
    setLoading(true)
    setError(null)
    const res = await retirementService.getHistory(query)
    if (res.success && res.data) {
      setRecords(res.data.data)
      setTotal(res.data.meta.total)
    } else {
      setError(res.error ?? 'Failed to load retirement history')
    }
    setLoading(false)
  }

  useEffect(() => {
    load({ page, limit: PAGE_SIZE })
  }, [page])

  async function handleExport() {
    setExporting(true)
    const blob = await retirementService.exportCsv()
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'retirement-history.csv'
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="corporate-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Retirement History</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">All on-chain verified retirements</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="corporate-btn-secondary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
          Export CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-3 p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
          role="alert"
        >
          <AlertCircle size={18} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <span className="text-sm text-red-800 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <FileText size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No retirement records yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Project</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Purpose</th>
                    <th className="pb-3 font-medium">Certificate</th>
                    <th className="pb-3 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(r.retiredAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {r.credit?.projectName ?? r.creditId}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-bold text-corporate-blue">
                          {r.amount.toLocaleString()} tCO₂
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                          {r.purpose}
                        </div>
                      </td>
                      <td className="py-4">
                        <a
                          href={retirementService.getCertificateDownloadUrl(r.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-corporate-blue hover:text-corporate-blue/80"
                        >
                          <FileText size={14} className="mr-1" />
                          {r.certificateId ?? 'View'}
                          <ExternalLink size={12} className="ml-1" />
                        </a>
                      </td>
                      <td className="py-4">
                        {r.transactionHash ? (
                          <a
                            href={`https://stellar.expert/explorer/public/tx/${r.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-corporate-blue"
                          >
                            <Globe size={14} className="mr-1" />
                            {r.transactionHash.slice(0, 8)}…
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total} record{total !== 1 ? 's' : ''} · page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 p-4 bg-linear-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center">
          <CheckCircle className="text-green-600 dark:text-green-400 mr-3 shrink-0" size={20} />
          <div>
            <div className="font-medium text-green-800 dark:text-green-300">
              All retirements verified on-chain
            </div>
            <div className="text-sm text-green-700/80 dark:text-green-400/80">
              Immutable proof stored on Stellar blockchain with Soroban smart contracts
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}