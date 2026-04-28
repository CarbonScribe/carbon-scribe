export type StellarTransferState = 'PENDING' | 'CONFIRMED' | 'FAILED'

export interface InitiateTransferRequest {
  purchaseId: string
  companyId: string
  projectId: string
  amount: number
  contractId: string
  fromAddress: string
  toAddress: string
}

export interface BatchTransferRequest {
  transfers: InitiateTransferRequest[]
}

export interface TransferRecord {
  id: string
  purchaseId: string
  companyId: string
  projectId: string
  amount: number
  status: StellarTransferState
  transactionHash?: string | null
  errorMessage?: string | null
  confirmedAt?: string | null
  createdAt?: string
  updatedAt?: string
}
