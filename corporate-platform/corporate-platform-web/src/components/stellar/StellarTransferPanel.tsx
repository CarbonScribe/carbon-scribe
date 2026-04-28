'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, Send, Wallet } from 'lucide-react'
import { ApiError } from '@/lib/api/http'
import { StellarApiClient, stellarApiClient } from '@/lib/api/stellar'
import type { InitiateTransferRequest, TransferRecord } from '@/types/stellar'

interface StellarTransferPanelProps {
  client?: StellarApiClient
  defaultCompanyId: string
}

const STATUS_ORDER: Record<string, number> = {
  FAILED: 0,
  PENDING: 1,
  CONFIRMED: 2,
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

  const pendingPurchaseIds = useMemo(
    () => records.filter((record) => record.status === 'PENDING').map((record) => record.purchaseId),
    [records],
  )

  useEffect(() => {
    if (!pendingPurchaseIds.length) {
      return
    }

    const interval = setInterval(async () => {
      for (const purchaseId of pendingPurchaseIds) {
        try {
          const status = await client.getTransferStatus(purchaseId)
          mergeRecord(status)
        } catch {
          // Polling errors should not interrupt user interactions.
        }
      }
    }, 8000)

    return () => clearInterval(interval)
  }, [client, pendingPurchaseIds])

  const mergeRecord = (record: TransferRecord) => {
    setRecords((previous) => {
      const index = previous.findIndex((entry) => entry.purchaseId === record.purchaseId)
      if (index === -1) {
        return [record, ...previous]
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

  const submitSingle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmittingSingle(true)
    setError(null)
    try {
      const record = await client.initiateTransfer(singleTransfer)
      mergeRecord(record)
      setStatusPurchaseId(record.purchaseId)
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
      const records = await client.batchTransfer({ transfers: parsed })
      mergeRecords(records)
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
      const record = await client.getTransferStatus(statusPurchaseId.trim())
      mergeRecord(record)
    } catch (reason) {
      setError(toErrorMessage(reason))
    } finally {
      setIsFetchingStatus(false)
    }
  }

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
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Activity size={14} />
            {pendingPurchaseIds.length} pending transfer(s)
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
                    <StatusPill status={record.status} />
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

function StatusPill({ status }: { status: string }) {
  if (status === 'CONFIRMED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-1 text-xs font-medium">
        <CheckCircle2 size={12} />
        Confirmed
      </span>
    )
  }

  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 text-xs font-medium">
        Failed
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 px-2 py-1 text-xs font-medium">
      Pending
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
