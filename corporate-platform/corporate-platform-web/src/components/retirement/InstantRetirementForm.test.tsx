import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InstantRetirementForm from '@/components/retirement/InstantRetirementForm'
import type { RetirementRecord } from '@/types/retirement'

// ── Mock the useRetirement hook so we can control retire() outcomes ─────────

const retireMock = vi.fn()
const clearRetireErrorMock = vi.fn()
const clearLastRetirementMock = vi.fn()

vi.mock('@/hooks/useRetirement', () => ({
  useRetirement: () => ({
    retire: retireMock,
    retiring: false,
    retireError: null,
    lastRetirement: null,
    clearRetireError: clearRetireErrorMock,
    clearLastRetirement: clearLastRetirementMock,
  }),
}))

const baseRecord: RetirementRecord = {
  id: 'ret-1',
  companyId: 'company-1',
  userId: 'user-1',
  creditId: 'credit-1',
  amount: 500,
  purpose: 'scope1',
  purposeDetails: null,
  priceAtRetirement: 18.5,
  retiredAt: new Date().toISOString(),
  certificateId: 'RET-2026-ABC123',
  transactionHash: 'tx_abc123',
}

const availableCredits = [
  {
    id: 'credit-1',
    projectName: 'Amazon Rainforest',
    country: 'Brazil',
    pricePerTon: 18,
    availableAmount: 5000,
  },
]

/** Advance from the three-step form to the pre-commit review step. */
function openReviewStep() {
  fireEvent.click(screen.getByRole('button', { name: /review retirement of/i }))
}

describe('InstantRetirementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    retireMock.mockResolvedValue(null)
  })

  it('renders purpose selector buttons', () => {
    render(<InstantRetirementForm />)

    expect(screen.getByText('Scope 1 Emissions')).toBeInTheDocument()
    expect(screen.getByText('Scope 2 Emissions')).toBeInTheDocument()
    expect(screen.getByText('Scope 3 Emissions')).toBeInTheDocument()
    expect(screen.getByText('Corporate Travel')).toBeInTheDocument()
    expect(screen.getByText('Events & Conferences')).toBeInTheDocument()
    expect(screen.getByText('Product Carbon')).toBeInTheDocument()
  })

  it('shows a credit-id text input when no availableCredits are provided', () => {
    render(<InstantRetirementForm />)
    expect(screen.getByPlaceholderText('Enter Credit ID')).toBeInTheDocument()
  })

  it('shows available credits as selectable buttons', () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)
    expect(screen.getByText('Amazon Rainforest')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Enter Credit ID')).not.toBeInTheDocument()
  })

  it('disables the submit button when no credit id is entered', () => {
    render(<InstantRetirementForm />)
    const button = screen.getByRole('button', { name: /review retirement of/i })
    expect(button).toBeDisabled()
  })

  it('enables submit after entering a credit id', () => {
    render(<InstantRetirementForm />)
    fireEvent.change(screen.getByPlaceholderText('Enter Credit ID'), {
      target: { value: 'credit-abc' },
    })
    const button = screen.getByRole('button', { name: /review retirement of/i })
    expect(button).not.toBeDisabled()
  })

  it('quick-amount buttons update the displayed amount', () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)

    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 5,000 tons' }))

    expect(screen.getByText('5,000 tCO₂')).toBeInTheDocument()
  })

  it('purpose-details input is present', () => {
    render(<InstantRetirementForm />)
    expect(
      screen.getByPlaceholderText(/optional: add purpose details/i),
    ).toBeInTheDocument()
  })

  it('keeps the existing three input steps', () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)

    expect(screen.getByText('1. Retirement Purpose')).toBeInTheDocument()
    expect(screen.getByText('2. Select Credit')).toBeInTheDocument()
    expect(screen.getByText('3. Amount to Retire')).toBeInTheDocument()
  })
})

// ── Pre-commit review step (#512) ──────────────────────────────────────────

describe('InstantRetirementForm – review step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    retireMock.mockResolvedValue(null)
  })

  it('opens the review step instead of calling the retirement API on submit', async () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)

    openReviewStep()

    await waitFor(() => {
      expect(screen.getByTestId('retirement-review-step')).toBeInTheDocument()
    })
    expect(retireMock).not.toHaveBeenCalled()
  })

  it('summarises wallet, beneficiary, amount, purpose, details and reporting impact', async () => {
    render(
      <InstantRetirementForm
        availableCredits={availableCredits}
        companyName="Acme Corp"
        companyWallet="GABC123WALLET"
      />,
    )

    fireEvent.click(screen.getByText('Scope 2 Emissions'))
    fireEvent.change(screen.getByPlaceholderText(/optional: add purpose details/i), {
      target: { value: 'Q1 2026 reporting' },
    })
    fireEvent.change(screen.getByLabelText('Reporting period'), {
      target: { value: 'FY2026 Q1' },
    })

    openReviewStep()

    const review = await screen.findByTestId('retirement-review-step')

    expect(review).toHaveTextContent('Amazon Rainforest')
    expect(review).toHaveTextContent('Acme Corp')
    expect(review).toHaveTextContent('GABC123WALLET')
    expect(review).toHaveTextContent('Scope 2 Emissions')
    expect(review).toHaveTextContent('Q1 2026 reporting')
    expect(review).toHaveTextContent('FY2026 Q1')
    expect(review).toHaveTextContent('GHG Protocol Corporate Standard')
    expect(review).toHaveTextContent('1,000 tCO₂')
  })

  it('returns to the form from the review step without retiring', async () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)

    openReviewStep()
    await screen.findByTestId('retirement-review-step')

    fireEvent.click(screen.getByRole('button', { name: /back & edit/i }))

    await waitFor(() => {
      expect(screen.queryByTestId('retirement-review-step')).not.toBeInTheDocument()
    })
    expect(screen.getByText('3. Amount to Retire')).toBeInTheDocument()
    expect(retireMock).not.toHaveBeenCalled()
  })

  it('preserves edited values when returning from the review step', async () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)

    fireEvent.click(screen.getByRole('button', { name: 'Set amount to 5,000 tons' }))
    openReviewStep()
    await screen.findByTestId('retirement-review-step')

    fireEvent.click(screen.getByRole('button', { name: /back & edit/i }))

    await waitFor(() => {
      expect(screen.getByText('5,000 tCO₂')).toBeInTheDocument()
    })
  })

  it('only calls retire() after the explicit confirm action', async () => {
    render(
      <InstantRetirementForm
        availableCredits={availableCredits}
        companyName="Acme Corp"
        companyWallet="GABC123WALLET"
      />,
    )

    fireEvent.click(screen.getByText('Scope 2 Emissions'))
    openReviewStep()
    await screen.findByTestId('retirement-review-step')

    expect(retireMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /confirm retirement of/i }))

    await waitFor(() => {
      expect(retireMock).toHaveBeenCalledWith(
        expect.objectContaining({
          creditId: 'credit-1',
          purpose: 'scope2',
          amount: expect.any(Number),
          beneficiaryName: 'Acme Corp',
          beneficiaryWallet: 'GABC123WALLET',
          reportingFramework: 'ghg-protocol',
        }),
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      )
    })
  })

  it('prevents a rapid double-click from submitting twice', async () => {
    retireMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return baseRecord
    })

    render(<InstantRetirementForm availableCredits={availableCredits} />)

    openReviewStep()
    await screen.findByTestId('retirement-review-step')

    const confirmButton = screen.getByRole('button', { name: /confirm retirement of/i })
    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(retireMock).toHaveBeenCalledTimes(1)
    })
  })

  it('shows the post-retirement receipt after a successful confirmation', async () => {
    retireMock.mockResolvedValue(baseRecord)

    render(<InstantRetirementForm availableCredits={availableCredits} />)

    openReviewStep()
    await screen.findByTestId('retirement-review-step')
    fireEvent.click(screen.getByRole('button', { name: /confirm retirement of/i }))

    await waitFor(() => {
      expect(retireMock).toHaveBeenCalled()
    })
  })

  it('calls onSuccess with the resulting record', async () => {
    retireMock.mockResolvedValue(baseRecord)
    const onSuccess = vi.fn()

    render(
      <InstantRetirementForm
        availableCredits={availableCredits}
        onSuccess={onSuccess}
      />,
    )

    openReviewStep()
    await screen.findByTestId('retirement-review-step')
    fireEvent.click(screen.getByRole('button', { name: /confirm retirement of/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(baseRecord)
    })
  })

  it('warns that the action is irreversible', async () => {
    render(<InstantRetirementForm availableCredits={availableCredits} />)

    openReviewStep()
    const review = await screen.findByTestId('retirement-review-step')

    expect(review).toHaveTextContent(/permanently retire/i)
    expect(review).toHaveTextContent(/cannot be recovered/i)
  })
})
