import { TransactionType } from '@prisma/client';

export interface ITransaction {
  id: string;
  type: TransactionType;
  orderId?: string;
  companyId: string;
  userId: string;
  amount: number;
  description: string;
  transactionHash?: string;
  createdAt: Date;
}

export interface IPaginatedTransactions {
  data: ITransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
