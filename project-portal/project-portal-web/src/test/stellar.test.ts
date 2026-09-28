import { describe, it, expect } from 'vitest';
import { getStellarExpertTxUrl, getStellarExpertAccountUrl } from '@/lib/stellar/retirement';

describe('Stellar Expert URL Helpers', () => {
  it('generates correct transaction URL for public network', () => {
    const hash = 'abc123def456';
    const url = getStellarExpertTxUrl(hash, 'public');
    expect(url).toBe('https://stellar.expert/explorer/public/tx/abc123def456');
  });

  it('generates correct transaction URL for testnet', () => {
    const hash = 'xyz789';
    const url = getStellarExpertTxUrl(hash, 'testnet');
    expect(url).toBe('https://stellar.expert/explorer/testnet/tx/xyz789');
  });

  it('defaults to public network when not specified', () => {
    const hash = 'default123';
    const url = getStellarExpertTxUrl(hash);
    expect(url).toBe('https://stellar.expert/explorer/public/tx/default123');
  });

  it('generates correct account URL for public network', () => {
    const accountId = 'GD123456789';
    const url = getStellarExpertAccountUrl(accountId, 'public');
    expect(url).toBe('https://stellar.expert/explorer/public/account/GD123456789');
  });

  it('generates correct account URL for testnet', () => {
    const accountId = 'GD987654321';
    const url = getStellarExpertAccountUrl(accountId, 'testnet');
    expect(url).toBe('https://stellar.expert/explorer/testnet/account/GD987654321');
  });

  it('defaults to public network for account URL when not specified', () => {
    const accountId = 'GDDEFAULT';
    const url = getStellarExpertAccountUrl(accountId);
    expect(url).toBe('https://stellar.expert/explorer/public/account/GDDEFAULT');
  });
});
