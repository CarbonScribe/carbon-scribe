export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  LOCKED = 'LOCKED',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum OperationType {
  TRANSFER = 'TRANSFER',
  RETIREMENT = 'RETIREMENT',
  APPROVE = 'APPROVE',
  MINT = 'MINT',
}

export interface IStellarKeypair {
  publicKey: string;
  secret: string;
}

export interface IWalletCreate {
  companyId: string;
}

export interface IWalletResponse {
  id: string;
  companyId: string;
  publicKey: string;
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBalanceResponse {
  xlm: {
    balance: string;
    assetType: 'native';
  };
  carbonCredits: ICarbonCreditBalance[];
}

export interface ICarbonCreditBalance {
  tokenId: number;
  balance: number;
  assetCode?: string;
  issuer?: string;
}

export interface ITransactionResponse {
  id: string;
  companyId: string;
  walletId: string;
  transactionHash: string;
  operationType: OperationType;
  status: TransactionStatus;
  amount: number;
  tokenIds: number[];
  submittedAt: Date;
  confirmedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ITransactionSubmit {
  companyId: string;
  walletId: string;
  transactionHash: string;
  operationType: OperationType;
  amount: number;
  tokenIds: number[];
  metadata?: Record<string, unknown>;
}

export interface IKeyPairEncrypted {
  encryptedData: string;
  authTag: string;
  iv: string;
}

export interface IHealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  network: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  lastChecked: Date;
  latency: number;
  error?: string;
}
