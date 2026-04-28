export interface IntegrityProof {
  eventId: string;
  expectedHash: string;
  computedHash: string;
  previousHash: string;
  expectedPreviousHash?: string;
  hashValid: boolean;
  chainLinkValid: boolean;
  anchored: boolean;
  transactionHash?: string | null;
  blockNumber?: number | null;
  checkedAt: Date;
}
