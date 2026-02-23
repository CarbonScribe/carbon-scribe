export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BatchRetirementItem {
  creditId: string;
  amount: number;
  purpose: string;
  purposeDetails?: string;
}

export interface BatchErrorItem {
  index: number;
  creditId?: string;
  error: string;
}

export interface BatchExecutionResult {
  totalItems: number;
  completedItems: number;
  failedItems: number;
  retirementIds: string[];
  errors: BatchErrorItem[];
}
