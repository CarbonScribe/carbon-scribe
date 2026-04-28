import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/http'
import { StellarApiClient } from '@/lib/api/stellar'

function buildResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response
}

describe('StellarApiClient', () => {
  it('calls initiate transfer endpoint with payload and token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      buildResponse({ id: 'tr_001', purchaseId: 'ord_1', status: 'PENDING', amount: 2 }),
    )
    const client = new StellarApiClient({
      baseUrl: 'http://localhost:4000',
      token: 'token-123',
      fetchImpl,
    })

    const result = await client.initiateTransfer({
      purchaseId: 'ord_1',
      companyId: 'corp_1',
      projectId: 'proj_1',
      amount: 2,
      contractId: 'contract_1',
      fromAddress: 'GA_FROM',
      toAddress: 'GA_TO',
    })

    expect(result.purchaseId).toBe('ord_1')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/stellar/transfers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    )
  })

  it('throws ApiError when backend returns failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      buildResponse({ message: 'Transfer not found' }, 404),
    )
    const client = new StellarApiClient({
      baseUrl: 'http://localhost:4000',
      fetchImpl,
    })

    await expect(client.getTransferStatus('missing')).rejects.toBeInstanceOf(ApiError)
    await expect(client.getTransferStatus('missing')).rejects.toMatchObject({
      status: 404,
      message: 'Transfer not found',
    })
  })

  it('posts transfer batches to batch endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      buildResponse([{ id: 'tr_1', purchaseId: 'ord_1', status: 'PENDING', amount: 5 }]),
    )
    const client = new StellarApiClient({
      baseUrl: 'http://localhost:4000',
      fetchImpl,
    })

    const result = await client.batchTransfer({
      transfers: [
        {
          purchaseId: 'ord_1',
          companyId: 'corp_1',
          projectId: 'proj_1',
          amount: 5,
          contractId: 'contract_1',
          fromAddress: 'GA_FROM',
          toAddress: 'GA_TO',
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/stellar/transfers/batch',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
