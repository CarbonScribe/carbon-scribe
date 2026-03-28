export type TransactionType =
  | 'order'
  | 'refund'
  | 'adjustment'
  | 'transfer'
  | 'retirement';

export interface TransactionRecord {
  id: string;
  companyId: string;
  userId?: string;
  type: TransactionType;
  orderId?: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface TransactionListResult {
  data: TransactionRecord[];
  total: number;
  page: number;
  limit: number;
}
