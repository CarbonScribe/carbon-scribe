import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
      screen.getByText(/retry in \d+s/i),
    ).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /retry in/i })
    expect(submit).toBeDisabled()

    fireEvent.click(submit)
    expect(onPlaceBid).not.toHaveBeenCalled()
  })
})
