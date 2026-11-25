import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import PlaceBidForm from './PlaceBidForm'
import { ErrorCode } from '@/lib/utils/errorParser'

const baseProps = {
  auctionId: 'auction-1',
  currentPrice: 10,
  floorPrice: 5,
  maxQuantity: 100,
  isActive: true,
  placingBid: false,
  bidError: null,
  bidSuccess: null,
  onPlaceBid: vi.fn(),
  onClearFeedback: vi.fn(),
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

describe('bid review', () => {
  it('shows the total and cancels without placing a bid', () => {
    const onPlaceBid = vi.fn()
    render(<PlaceBidForm {...baseProps} onPlaceBid={onPlaceBid} />)
    fireEvent.click(screen.getByRole('button', { name: 'Place Bid' }))
    expect(screen.getByRole('dialog', { name: /review your bid/i })).toHaveTextContent('Total cost')
    expect(screen.getByRole('dialog')).toHaveTextContent('$10.00')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onPlaceBid).not.toHaveBeenCalled()
  })

  it('confirms once even when clicked repeatedly while pending', () => {
    const onPlaceBid = vi.fn(() => new Promise<void>(() => {}))
    render(<PlaceBidForm {...baseProps} onPlaceBid={onPlaceBid} />)
    fireEvent.click(screen.getByRole('button', { name: 'Place Bid' }))
    const confirm = screen.getByRole('button', { name: /confirm bid/i })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(onPlaceBid).toHaveBeenCalledTimes(1)
    expect(onPlaceBid).toHaveBeenCalledWith({ bidPrice: 10, quantity: 1 })
  })

  it('requires acknowledgement for a high bid or total', () => {
    const onPlaceBid = vi.fn(() => new Promise<void>(() => {}))
    render(<PlaceBidForm {...baseProps} onPlaceBid={onPlaceBid} highTotalThreshold={20} />)
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '13' } })
    fireEvent.click(screen.getByRole('button', { name: 'Place Bid' }))
    expect(screen.getByRole('alert')).toHaveTextContent('25% above')
    const confirm = screen.getByRole('button', { name: /confirm bid/i })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(onPlaceBid).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape', () => {
    const onPlaceBid = vi.fn()
    render(<PlaceBidForm {...baseProps} onPlaceBid={onPlaceBid} />)
    fireEvent.click(screen.getByRole('button', { name: 'Place Bid' }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onPlaceBid).not.toHaveBeenCalled()
  })
})

describe('PlaceBidForm rate limiting', () => {
  it('shows the countdown and blocks resubmission after a 429', () => {
    const onPlaceBid = vi.fn()
    render(
      <PlaceBidForm
        {...baseProps}
        onPlaceBid={onPlaceBid}
        bidRateLimitError={{
          code: ErrorCode.RATE_LIMITED,
          statusCode: 429,
          message: 'Too many attempts',
          retryAfterMs: 5000,
        }}
      />,
    )

    expect(
      screen.getByText(/too many attempts — try again in \d+s/i),
    ).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /place bid/i })
    expect(submit).toBeDisabled()

    fireEvent.click(submit)
    expect(onPlaceBid).not.toHaveBeenCalled()
  })
})
