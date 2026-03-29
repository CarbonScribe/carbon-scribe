export enum OwnershipEventType {
  MINT = 'MINT',
  TRANSFER = 'TRANSFER',
  RETIREMENT = 'RETIREMENT',
}

export interface IOwnershipHistoryRecord {
  id?: string;
  tokenId: number;
  companyId?: string;
  previousOwner: string;
  newOwner: string;
  eventType: OwnershipEventType;
  transactionHash: string;
  blockNumber: number;
  ledgerSequence: number;
  metadata?: any;
  timestamp: Date;
  createdAt?: Date;
}

export interface IOwnershipVerification {
  tokenId: number;
  currentOwner: string;
  lineage: IOwnershipHistoryRecord[];
  isVerified: boolean;
}

export interface ICompanyPortfolio {
  companyId: string;
  tokens: {
    tokenId: number;
    lastUpdated: Date;
  }[];
}
