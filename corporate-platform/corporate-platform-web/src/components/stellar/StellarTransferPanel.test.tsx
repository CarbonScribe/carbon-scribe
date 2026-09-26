import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StellarTransferPanel from '@/components/stellar/StellarTransferPanel'
import type { StellarApiClient } from '@/lib/api/stellar'

function buildClient(overrides?: Partial<StellarApiClient>): StellarApiClient {
  return {
    initiateTransfer: async () => ({
      id: 'tr_1',
      purchaseId: 'ord_1',
      companyId: 'corp_1',
      projectId: 'proj_1',
      amount: 12,
      status: 'PENDING',
      transactionHash: null,
      errorMessage: null,
      submittedAt: new Date().toISOString(),
      confirmedAt: null,
    }),
    batchTransfer: async () => [
      {
        id: 'tr_2',
        purchaseId: 'ord_2',
        companyId: 'corp_1',
        projectId: 'proj_1',
        amount: 9,
        status: 'CONFIRMED',
        transactionHash: 'hash_1',
        errorMessage: null,
        confirmedAt: new Date().toISOString(),
      },
    ],
    getTransferStatus: async () => ({
      id: 'tr_1',
      purchaseId: 'ord_1',
      companyId: 'corp_1',
      projectId: 'proj_1',
      amount: 12,
      status: 'CONFIRMED',
      transactionHash: 'hash_2',
      errorMessage: null,
      confirmedAt: new Date().toISOString(),
    }),
    ...overrides,
  } as StellarApiClient
}

function fillSingleTransferForm(purchaseId: string) {
  fireEvent.change(screen.getByLabelText('Purchase ID'), { target: { value: purchaseId } })
  fireEvent.change(screen.getByLabelText('Project ID'), { target: { value: 'proj_1' } })
  fireEvent.change(screen.getByLabelText('Contract ID'), { target: { value: 'contract_1' } })
  fireEvent.change(screen.getByLabelText('From Address'), { target: { value: 'GA_FROM' } })
  fireEvent.change(screen.getByLabelText('To Address'), { target: { value: 'GA_TO' } })
}

describe('StellarTransferPanel', () => {
  it('submits a transfer and renders it as SUBMITTED, not a generic pending pill', async () => {
    const client = buildClient()
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fillSingleTransferForm('ord_1')
    fireEvent.click(screen.getByRole('button', { name: 'Initiate Transfer' }))

    await waitFor(() => {
      expect(screen.getByText('ord_1')).toBeInTheDocument()
    })

    // A just-broadcast transfer is SUBMITTED with an elapsed readout, distinct
    // from the amber PENDING state a polled record gets.
    expect(screen.getByText(/^Submitted — \d+s$/)).toBeInTheDocument()
    expect(screen.queryByText('Pending')).not.toBeInTheDocument()
  })

  it('keeps an inline "awaiting confirmation" indicator after the POST resolves', async () => {
    const client = buildClient()
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fillSingleTransferForm('ord_1')
    fireEvent.click(screen.getByRole('button', { name: 'Initiate Transfer' }))

    // The submit button returns to idle, but the transfer is still unconfirmed
    // on-chain, so the panel must say so rather than looking neutral.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Initiate Transfer' })).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Submitted — awaiting on-chain confirmation/),
    ).toBeInTheDocument()
  })

  it('shows user-friendly API errors', async () => {
    const client = buildClient({
      initiateTransfer: async () => {
        throw new Error('Network timeout')
      },
    })
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fillSingleTransferForm('ord_3')
    fireEvent.click(screen.getByRole('button', { name: 'Initiate Transfer' }))

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeInTheDocument()
    })
  })

  it('checks a transfer status by purchase ID', async () => {
    const client = buildClient()
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByPlaceholderText('Enter purchase ID'), { target: { value: 'ord_1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }))

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument()
      expect(screen.getByText('hash_2...')).toBeInTheDocument()
    })
  })

})

// ── Elapsed time & staleness escalation (FE-069) ───────────────────────────

/**
 * These assertions read exact elapsed labels, so the clock is frozen: with a
 * live clock, the gap between render and assertion makes "30s" flip to "29s"
 * or "31s" nondeterministically.
 */
const FROZEN_NOW = new Date('2026-08-25T12:00:00.000Z')

describe('StellarTransferPanel – elapsed time and stuck transfers', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a polled non-terminal record as PENDING with elapsed time', async () => {
    const client = buildClient({
      getTransferStatus: async () => ({
        id: 'tr_9',
        purchaseId: 'ord_9',
        companyId: 'corp_1',
        projectId: 'proj_1',
        amount: 4,
        status: 'PENDING',
        transactionHash: 'hash_9',
        errorMessage: null,
        submittedAt: new Date(FROZEN_NOW.getTime() - 30_000).toISOString(),
        confirmedAt: null,
      }),
    })
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByPlaceholderText('Enter purchase ID'), { target: { value: 'ord_9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }))

    await waitFor(() => {
      expect(screen.getByText(/^Pending — 3\ds$/)).toBeInTheDocument()
    })
  })

  it('flags a transfer pending beyond the threshold as potentially stuck', async () => {
    const client = buildClient({
      getTransferStatus: async () => ({
        id: 'tr_stuck',
        purchaseId: 'ord_stuck',
        companyId: 'corp_1',
        projectId: 'proj_1',
        amount: 7,
        status: 'PENDING',
        transactionHash: 'hash_stuck',
        errorMessage: null,
        // Well past the 2-minute default stuck threshold.
        submittedAt: new Date(FROZEN_NOW.getTime() - 5 * 60_000).toISOString(),
        confirmedAt: null,
      }),
    })
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByPlaceholderText('Enter purchase ID'), {
      target: { value: 'ord_stuck' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }))

    await waitFor(() => {
      expect(screen.getByText('Taking longer than expected')).toBeInTheDocument()
    })
    expect(screen.getByText('1 possibly stuck')).toBeInTheDocument()
    expect(screen.getByText(/^Pending — 5m \d\ds$/)).toBeInTheDocument()
  })

  it('escalates to "likely stuck" past the severe threshold', async () => {
    const client = buildClient({
      getTransferStatus: async () => ({
        id: 'tr_dead',
        purchaseId: 'ord_dead',
        companyId: 'corp_1',
        projectId: 'proj_1',
        amount: 7,
        status: 'PENDING',
        transactionHash: 'hash_dead',
        errorMessage: null,
        submittedAt: new Date(FROZEN_NOW.getTime() - 20 * 60_000).toISOString(),
        confirmedAt: null,
      }),
    })
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByPlaceholderText('Enter purchase ID'), {
      target: { value: 'ord_dead' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }))

    await waitFor(() => {
      expect(screen.getByText('Likely stuck — investigate')).toBeInTheDocument()
    })
  })

  it('advances the elapsed readout while a transfer stays unconfirmed', async () => {
    const client = buildClient({
      getTransferStatus: async () => ({
        id: 'tr_tick',
        purchaseId: 'ord_tick',
        companyId: 'corp_1',
        projectId: 'proj_1',
        amount: 3,
        status: 'PENDING',
        transactionHash: null,
        errorMessage: null,
        submittedAt: FROZEN_NOW.toISOString(),
        confirmedAt: null,
      }),
    })
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByPlaceholderText('Enter purchase ID'), {
      target: { value: 'ord_tick' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Check Status' }))

    const elapsedSeconds = () => {
      const match = screen
        .getByText(/^Pending — \d+s$/)
        .textContent?.match(/(\d+)s$/)
      return Number(match?.[1] ?? -1)
    }

    await waitFor(() => {
      expect(screen.getByText(/^Pending — \d+s$/)).toBeInTheDocument()
    })

    // Flush the effect that starts the tick interval before measuring.
    await act(async () => {})
    const before = elapsedSeconds()

    // No new poll happens here — only the local 1s tick — so any increase
    // proves the elapsed readout is live rather than frozen at fetch time.
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(elapsedSeconds()).toBeGreaterThanOrEqual(before + 3)
    })
  })
})
