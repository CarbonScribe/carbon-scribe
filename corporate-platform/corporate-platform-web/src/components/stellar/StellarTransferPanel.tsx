'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  Send,
  Wallet,
} from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { StellarApiClient, stellarApiClient } from '@/lib/api/stellar'
import type { InitiateTransferRequest, TransferRecord } from '@/types/stellar'
import { isTerminalTransferState } from '@/types/stellar'
import {
  ELAPSED_TICK_MS,
  POLL_INTERVAL_MS,
  buildStatusView,
  normalizeStatus,
} from '@/lib/stellar/transfer-status'

interface StellarTransferPanelProps {
  client?: StellarApiClient
  defaultCompanyId: string
}

const STATUS_ORDER: Record<string, number> = {
  FAILED: 0,
  SUBMITTED: 1,
  PENDING: 2,
  CONFIRMED: 3,
}

const STELLAR_EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL ??
  'https://stellar.expert/explorer/testnet/tx'

export default function StellarTransferPanel({
  client = stellarApiClient,
  defaultCompanyId,
}: StellarTransferPanelProps) {
  const [singleTransfer, setSingleTransfer] = useState<InitiateTransferRequest>({
    purchaseId: '',
    companyId: defaultCompanyId,
    projectId: '',
    amount: 1,
    contractId: '',
    fromAddress: '',
    toAddress: '',
  })
  const [batchText, setBatchText] = useState('')
  const [statusPurchaseId, setStatusPurchaseId] = useState('')
  const [records, setRecords] = useState<TransferRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false)
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)
  const [isFetchingStatus, setIsFetchingStatus] = useState(false)
  /**
   * Purchase IDs this session has initiated that have not yet reached a terminal
   * state. Drives the "submitted, awaiting confirmation" indicator so the submit
   * controls never fall back to a neutral idle state while a transfer they
   * started is still in flight on-chain (FE-069).
   */
  const [awaitingSingle, setAwaitingSingle] = useState<string | null>(null)
  const [awaitingBatch, setAwaitingBatch] = useState<string[]>([])
  /**
   * Purchase IDs whose status has been observed by at least one poll. Until a
   * poll returns, a record we just created is reported as SUBMITTED rather than
   * borrowing the backend's generic PENDING.
   */
  const observedRef = useRef<Set<string>>(new Set())
  /** Ticks once a second so elapsed-time labels stay live. */
  const [now, setNow] = useState(() => Date.now())

  const inFlightRecords = useMemo(
    () => records.filter((record) => !isTerminalTransferState(record.status)),
    [records],
  )

  const inFlightPurchaseIds = useMemo(
    () => inFlightRecords.map((record) => record.purchaseId),
    [inFlightRecords],
  )

  const inFlightKey = inFlightPurchaseIds.join('|')

  // Re-render elapsed labels while anything is unconfirmed. Stops entirely once
  // every transfer is terminal, so an idle panel does not tick forever.
  useEffect(() => {
    if (!inFlightKey) return

    const interval = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS)
    return () => clearInterval(interval)
  }, [inFlightKey])

  useEffect(() => {
    if (!inFlightKey) {
      return
    }

    const purchaseIds = inFlightKey.split('|')

    const interval = setInterval(async () => {
      for (const purchaseId of purchaseIds) {
        try {
          const status = await client.getTransferStatus(purchaseId)
          // The first poll is what promotes a record out of the local
          // SUBMITTED state into whatever the chain actually reports.
          observedRef.current.add(purchaseId)
          mergeRecord(status)
        } catch {
          // Polling errors should not interrupt user interactions.
        }
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [client, inFlightKey])

  /**
   * Present a record's status, substituting SUBMITTED for the backend's generic
   * non-terminal status until the first poll has observed it.
   */
  const withLocalState = useCallback((record: TransferRecord): TransferRecord => {
    const status = normalizeStatus(record.status)

    if (isTerminalTransferState(status)) return { ...record, status }
    if (observedRef.current.has(record.purchaseId)) return { ...record, status }

    return { ...record, status: 'SUBMITTED' }
  }, [])

  const mergeRecord = (record: TransferRecord) => {
    setRecords((previous) => {
      const index = previous.findIndex((entry) => entry.purchaseId === record.purchaseId)
      if (index === -1) {
        return sortRecords([record, ...previous])
      }
      const next = [...previous]
      next[index] = { ...next[index], ...record }
      return sortRecords(next)
    })
  }

  const mergeRecords = (items: TransferRecord[]) => {
    setRecords((previous) => {
      const map = new Map(previous.map((entry) => [entry.purchaseId, entry]))
      for (const item of items) {
        const current = map.get(item.purchaseId)
        map.set(item.purchaseId, { ...current, ...item })
      }
      return sortRecords(Array.from(map.values()))
    })
  }

  const sortRecords = (items: TransferRecord[]): TransferRecord[] => {
    return [...items].sort((a, b) => {
      const statusCompare = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      if (statusCompare !== 0) {
        return statusCompare
      }
      return a.purchaseId.localeCompare(b.purchaseId)
    })
  }

  const toErrorMessage = (reason: unknown): string => {
    if (reason instanceof ApiError) {
      return reason.message
    }
    if (reason instanceof Error) {
      return reason.message
    }
    return 'An unexpected error occurred while processing transfer data.'
  }

  /**
   * Stamp a broadcast time on a freshly-initiated record so elapsed-time and
   * staleness indicators work even if the backend has not yet populated
   * `submittedAt` (see the backend dependency noted on `TransferRecord`).
   */
  const stampSubmission = (record: TransferRecord): TransferRecord => ({
    ...record,
    submittedAt: record.submittedAt ?? record.initiatedAt ?? new Date().toISOString(),
  })

  const submitSingle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmittingSingle(true)
    setError(null)
    try {
      const record = stampSubmission(await client.initiateTransfer(singleTransfer))
      mergeRecord(record)
      setStatusPurchaseId(record.purchaseId)
      // The POST has resolved but the transfer is still unconfirmed on-chain —
      // hold the "awaiting confirmation" indicator rather than reverting to idle.
      setAwaitingSingle(
        isTerminalTransferState(record.status) ? null : record.purchaseId,
      )
    } catch (reason) {
      setError(toErrorMessage(reason))
    } finally {
      setIsSubmittingSingle(false)
    }
  }

  const submitBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmittingBatch(true)
    setError(null)
    try {
      const parsed = JSON.parse(batchText) as InitiateTransferRequest[]
      const submitted = (await client.batchTransfer({ transfers: parsed })).map(
        stampSubmission,
      )
      mergeRecords(submitted)
      setAwaitingBatch(
        submitted
          .filter((record) => !isTerminalTransferState(record.status))
          .map((record) => record.purchaseId),
      )
    } catch (reason) {
      setError(toErrorMessage(reason))
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  const fetchStatus = async () => {
    if (!statusPurchaseId.trim()) {
      setError('Enter a purchase ID to fetch transfer status.')
      return
    }

    setIsFetchingStatus(true)
    setError(null)
    try {
      const purchaseId = statusPurchaseId.trim()
      const record = await client.getTransferStatus(purchaseId)
      observedRef.current.add(purchaseId)
      mergeRecord(record)
    } catch (reason) {
      setError(toErrorMessage(reason))
    } finally {
      setIsFetchingStatus(false)
    }
  }

  const terminalIds = useMemo(
    () =>
      new Set(
        records
          .filter((record) => isTerminalTransferState(record.status))
          .map((record) => record.purchaseId),
      ),
    [records],
  )

  // Clear the "awaiting confirmation" indicators once the underlying transfers
  // reach a terminal state.
  useEffect(() => {
    if (awaitingSingle && terminalIds.has(awaitingSingle)) {
      setAwaitingSingle(null)
    }
    if (awaitingBatch.some((id) => terminalIds.has(id))) {
      setAwaitingBatch((previous) => previous.filter((id) => !terminalIds.has(id)))
    }
  }, [awaitingSingle, awaitingBatch, terminalIds])

  const singleAwaitingRecord = awaitingSingle
    ? records.find((record) => record.purchaseId === awaitingSingle)
    : undefined

  const stuckCount = useMemo(
    () =>
      inFlightRecords.filter(
        (record) =>
          buildStatusView(withLocalState(record), now).staleness !== 'fresh',
      ).length,
    [inFlightRecords, now, withLocalState],
  )

  return (
    <div className="corporate-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stellar Transfer Center</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Initiate blockchain transfers, track status, and monitor on-chain confirmation history.
          </p>
        </div>
        <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-3">
          <Wallet className="text-corporate-blue" size={20} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={submitSingle} className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Single Transfer</div>
          <LabeledInput
            label="Purchase ID"
            value={singleTransfer.purchaseId}
            onChange={(value) => setSingleTransfer((previous) => ({ ...previous, purchaseId: value }))}
            required
          />
          <LabeledInput
            label="Company ID"
            value={singleTransfer.companyId}
            onChange={(value) => setSingleTransfer((previous) => ({ ...previous, companyId: value }))}
            required
          />
          <LabeledInput
            label="Project ID"
            value={singleTransfer.projectId}
            onChange={(value) => setSingleTransfer((previous) => ({ ...previous, projectId: value }))}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <LabeledInput
              label="Amount"
              type="number"
              min={1}
              value={String(singleTransfer.amount)}
              onChange={(value) =>
                setSingleTransfer((previous) => ({ ...previous, amount: Math.max(1, Number(value) || 1) }))
              }
              required
            />
            <LabeledInput
              label="Contract ID"
              value={singleTransfer.contractId}
              onChange={(value) => setSingleTransfer((previous) => ({ ...previous, contractId: value }))}
              required
            />
          </div>
          <LabeledInput
            label="From Address"
            value={singleTransfer.fromAddress}
            onChange={(value) => setSingleTransfer((previous) => ({ ...previous, fromAddress: value }))}
            required
          />
          <LabeledInput
            label="To Address"
            value={singleTransfer.toAddress}
            onChange={(value) => setSingleTransfer((previous) => ({ ...previous, toAddress: value }))}
            required
          />
          <button disabled={isSubmittingSingle} type="submit" className="corporate-btn-primary w-full py-2.5">
            <Send size={16} className="mr-2" />
            {isSubmittingSingle ? 'Submitting...' : 'Initiate Transfer'}
          </button>
          {awaitingSingle && (
            <AwaitingConfirmationNotice
              purchaseIds={[awaitingSingle]}
              record={singleAwaitingRecord}
              now={now}
              withLocalState={withLocalState}
            />
          )}
        </form>

        <form onSubmit={submitBatch} className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="font-semibold text-gray-900 dark:text-white">Batch Transfers</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Provide a JSON array using the single transfer payload shape.
          </p>
          <textarea
            value={batchText}
            onChange={(event) => setBatchText(event.target.value)}
            placeholder="[{&quot;purchaseId&quot;:&quot;order-101&quot;,&quot;companyId&quot;:&quot;corp_001&quot;,...}]"
            className="w-full min-h-52 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono"
          />
          <button disabled={isSubmittingBatch} type="submit" className="corporate-btn-primary w-full py-2.5">
            <Send size={16} className="mr-2" />
            {isSubmittingBatch ? 'Sending Batch...' : 'Submit Batch Transfers'}
          </button>
          {awaitingBatch.length > 0 && (
            <AwaitingConfirmationNotice
              purchaseIds={awaitingBatch}
              record={records.find((record) => record.purchaseId === awaitingBatch[0])}
              now={now}
              withLocalState={withLocalState}
            />
          )}
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
        <div className="font-semibold text-gray-900 dark:text-white">Transfer Status Lookup</div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={statusPurchaseId}
            onChange={(event) => setStatusPurchaseId(event.target.value)}
            placeholder="Enter purchase ID"
            className="flex-1 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
          />
          <button
            type="button"
            disabled={isFetchingStatus}
            onClick={fetchStatus}
            className="corporate-btn-secondary py-2.5 px-4"
          >
            <RefreshCcw size={16} className="mr-2" />
            {isFetchingStatus ? 'Checking...' : 'Check Status'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-gray-900 dark:text-white">On-Chain Activity</div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Activity size={14} />
              {inFlightPurchaseIds.length} unconfirmed transfer(s)
            </span>
            {stuckCount > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle size={14} />
                {stuckCount} possibly stuck
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 pr-2">Purchase ID</th>
                <th className="pb-2 pr-2">Amount</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2 pr-2">Transaction</th>
                <th className="pb-2 pr-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-500 dark:text-gray-400">
                    No transfer activity yet.
                  </td>
                </tr>
              )}
              {records.map((record) => (
                <tr key={record.purchaseId} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-2 font-medium text-gray-900 dark:text-white">{record.purchaseId}</td>
                  <td className="py-3 pr-2">{record.amount.toLocaleString()} tCO2</td>
                  <td className="py-3 pr-2">
                    <StatusPill record={withLocalState(record)} now={now} />
                  </td>
                  <td className="py-3 pr-2">
                    {record.transactionHash ? (
                      <a
                        href={`${STELLAR_EXPLORER_BASE_URL}/${record.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-corporate-blue hover:underline"
                      >
                        {record.transactionHash.slice(0, 12)}...
                      </a>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-red-600 dark:text-red-400">{record.errorMessage ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline indicator that keeps a just-submitted transfer visible on the form
 * that started it, so the submit control never reverts to a neutral idle state
 * while the transfer is still unconfirmed on-chain (FE-069).
 */
function AwaitingConfirmationNotice({
  purchaseIds,
  record,
  now,
  withLocalState,
}: {
  purchaseIds: string[]
  record?: TransferRecord
  now: number
  withLocalState: (record: TransferRecord) => TransferRecord
}) {
  const view = record ? buildStatusView(withLocalState(record), now) : null
  const stuck = view?.staleness !== 'fresh' && view != null

  const tone = stuck
    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
    : 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'

  const subject =
    purchaseIds.length === 1
      ? purchaseIds[0]
      : `${purchaseIds.length} transfers`

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${tone}`}
    >
      {stuck ? (
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      ) : (
        <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />
      )}
      <span>
        <span className="font-medium">
          {stuck
            ? 'Submitted — still unconfirmed'
            : 'Submitted — awaiting on-chain confirmation'}
        </span>
        {': '}
        {subject}
        {view?.elapsedLabel ? ` · ${view.elapsedLabel} elapsed` : ''}
      </span>
    </div>
  )
}

/**
 * Status pill with a visually distinct treatment per confirmation state, an
 * elapsed-time readout for non-terminal transfers, and an amber → red
 * escalation once a transfer has been unconfirmed past the stuck threshold
 * (FE-069).
 */
function StatusPill({ record, now }: { record: TransferRecord; now?: number }) {
  const view = buildStatusView(record, now ?? Date.now())

  if (view.status === 'CONFIRMED') {
    return (
      <span
        title={view.description}
        aria-label={view.description}
        className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 text-xs font-medium"
      >
        <CheckCircle2 size={12} />
        Confirmed
      </span>
    )
  }

  if (view.status === 'FAILED') {
    return (
      <span
        title={view.description}
        aria-label={view.description}
        className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 text-xs font-medium"
      >
        <AlertTriangle size={12} />
        Failed
      </span>
    )
  }

  // Non-terminal. SUBMITTED reads as calm/blue and in-motion; PENDING is amber;
  // either escalates to red once it crosses the stuck threshold.
  const isStuck = view.staleness !== 'fresh'

  const tone = isStuck
    ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-1 ring-red-400/60'
    : view.status === 'SUBMITTED'
      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
      : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'

  const Icon = isStuck ? AlertTriangle : view.status === 'SUBMITTED' ? Loader2 : Clock

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        title={view.description}
        aria-label={view.description}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tone}`}
      >
        <Icon
          size={12}
          className={!isStuck && view.status === 'SUBMITTED' ? 'animate-spin' : undefined}
        />
        {view.elapsedLabel ? `${view.label} — ${view.elapsedLabel}` : view.label}
      </span>
      {isStuck && (
        <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
          {view.staleness === 'severely-stuck'
            ? 'Likely stuck — investigate'
            : 'Taking longer than expected'}
        </span>
      )}
    </span>
  )
}

interface LabeledInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  min?: number
}

function LabeledInput({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  min,
}: LabeledInputProps) {
  return (
    <label className="block text-sm text-gray-700 dark:text-gray-300">
      <span className="mb-1 block">{label}</span>
      <input
        required={required}
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
      />
    </label>
  )
}
