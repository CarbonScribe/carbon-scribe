export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export type PaymentMethod = 'credit_card' | 'wire' | 'crypto';

export interface OrderItemDetails {
  id: string;
  creditId: string;
  projectName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderDetails {
  id: string;
  orderNumber: string;
  companyId: string;
  userId: string;
  items: OrderItemDetails[];
  subtotal: number;
  serviceFee: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: string;
  paymentId?: string;
  paidAt?: Date;
  transactionHash?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface OrderListResult {
  data: OrderDetails[];
  total: number;
  page: number;
  limit: number;
}
