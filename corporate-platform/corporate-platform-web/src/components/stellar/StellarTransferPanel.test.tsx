import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('StellarTransferPanel', () => {
  it('submits a transfer and renders activity row', async () => {
    const client = buildClient()
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByLabelText('Purchase ID'), { target: { value: 'ord_1' } })
    fireEvent.change(screen.getByLabelText('Project ID'), { target: { value: 'proj_1' } })
    fireEvent.change(screen.getByLabelText('Contract ID'), { target: { value: 'contract_1' } })
    fireEvent.change(screen.getByLabelText('From Address'), { target: { value: 'GA_FROM' } })
    fireEvent.change(screen.getByLabelText('To Address'), { target: { value: 'GA_TO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Initiate Transfer' }))

    await waitFor(() => {
      expect(screen.getByText('ord_1')).toBeInTheDocument()
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
  })

  it('shows user-friendly API errors', async () => {
    const client = buildClient({
      initiateTransfer: async () => {
        throw new Error('Network timeout')
      },
    })
    render(<StellarTransferPanel client={client} defaultCompanyId="corp_1" />)

    fireEvent.change(screen.getByLabelText('Purchase ID'), { target: { value: 'ord_3' } })
    fireEvent.change(screen.getByLabelText('Project ID'), { target: { value: 'proj_1' } })
    fireEvent.change(screen.getByLabelText('Contract ID'), { target: { value: 'contract_1' } })
    fireEvent.change(screen.getByLabelText('From Address'), { target: { value: 'GA_FROM' } })
    fireEvent.change(screen.getByLabelText('To Address'), { target: { value: 'GA_TO' } })
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
