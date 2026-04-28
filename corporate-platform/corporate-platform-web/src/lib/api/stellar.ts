import { ApiError, apiRequest } from '@/lib/api/http'
import type {
  BatchTransferRequest,
  InitiateTransferRequest,
  TransferRecord,
} from '@/types/stellar'

interface StellarClientOptions {
  baseUrl?: string
  token?: string
  getToken?: () => string | undefined
  fetchImpl?: typeof fetch
}

export class StellarApiClient {
  private readonly baseUrl?: string
  private readonly token?: string
  private readonly getToken?: () => string | undefined
  private readonly fetchImpl?: typeof fetch

  constructor(options: StellarClientOptions = {}) {
    this.baseUrl = options.baseUrl
    this.token = options.token
    this.getToken = options.getToken
    this.fetchImpl = options.fetchImpl
  }

  async initiateTransfer(payload: InitiateTransferRequest): Promise<TransferRecord> {
    return apiRequest<TransferRecord>(
      '/api/v1/stellar/transfers',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        baseUrl: this.baseUrl,
        token: this.getAuthToken(),
        fetchImpl: this.fetchImpl,
      },
    )
  }

  async batchTransfer(payload: BatchTransferRequest): Promise<TransferRecord[]> {
    return apiRequest<TransferRecord[]>(
      '/api/v1/stellar/transfers/batch',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      {
        baseUrl: this.baseUrl,
        token: this.getAuthToken(),
        fetchImpl: this.fetchImpl,
      },
    )
  }

  async getTransferStatus(purchaseId: string): Promise<TransferRecord> {
    const options = {
      baseUrl: this.baseUrl,
      token: this.getAuthToken(),
      fetchImpl: this.fetchImpl,
    }

    try {
      return await apiRequest<TransferRecord>(
        `/api/v1/stellar/purchases/${encodeURIComponent(purchaseId)}/transfer-status`,
        {
          method: 'GET',
        },
        options,
      )
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error
      }

      return apiRequest<TransferRecord>(
        `/api/v1/purchases/${encodeURIComponent(purchaseId)}/transfer-status`,
        {
          method: 'GET',
        },
        options,
      )
    }
  }

  private getAuthToken(): string | undefined {
    if (this.getToken) {
      return this.getToken()
    }
    return this.token
  }
}

export const stellarApiClient = new StellarApiClient()
