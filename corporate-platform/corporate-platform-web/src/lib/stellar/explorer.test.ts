import { afterEach, describe, expect, it } from 'vitest'
import { getStellarExplorerUrl } from '@/lib/stellar/explorer'

const ENV_VAR = 'NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL'

describe('getStellarExplorerUrl', () => {
  const original = process.env[ENV_VAR]

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_VAR]
    } else {
      process.env[ENV_VAR] = original
    }
  })

  it('falls back to the testnet explorer when no env var is set, matching env.ts', () => {
    delete process.env[ENV_VAR]

    expect(getStellarExplorerUrl('tx-hash-1')).toBe(
      'https://stellar.expert/explorer/testnet/tx/tx-hash-1',
    )
  })

  it('uses NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL when it is set', () => {
    process.env[ENV_VAR] = 'https://stellar.expert/explorer/public/tx'

    expect(getStellarExplorerUrl('tx-hash-1')).toBe(
      'https://stellar.expert/explorer/public/tx/tx-hash-1',
    )
  })
})
