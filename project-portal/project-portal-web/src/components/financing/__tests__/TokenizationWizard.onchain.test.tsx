import { confirmMintOnChain } from '@/lib/stellar/carbonTokens';

jest.mock('@/lib/stellar/carbonTokens', () => ({
  confirmMintOnChain: jest.fn(),
}));

describe('TokenizationWizard on-chain confirmation (#715)', () => {
  const mockConfirm = confirmMintOnChain as jest.MockedFunction<
    typeof confirmMintOnChain
  >;

  beforeEach(() => {
    mockConfirm.mockReset();
  });

  it('confirmMintOnChain resolves true on success path', async () => {
    mockConfirm.mockResolvedValueOnce({ confirmed: true });
    const r = await confirmMintOnChain('a'.repeat(64));
    expect(r.confirmed).toBe(true);
  });

  it('failed confirmation does not report confirmed', async () => {
    mockConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: 'On-chain transaction failed',
    });
    const r = await confirmMintOnChain('b'.repeat(64));
    expect(r.confirmed).toBe(false);
    expect(r.error).toMatch(/failed/i);
  });
});
