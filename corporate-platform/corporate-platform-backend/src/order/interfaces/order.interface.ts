export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface OrderItemDetail {
  id: string;
  creditId: string;
  projectName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderStatusEvent {
  event: string;
  fromStatus: string | null;
  toStatus: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  companyId: string;
  userId: string;
  items: OrderItemDetail[];
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
  data: OrderDetail[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderStats {
  totalSpent: number;
  orderCount: number;
  avgOrderValue: number;
  byStatus: Record<string, number>;
}

export interface OrderStatusResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  updatedAt: Date;
  events: OrderStatusEvent[];
  failureReason?: string;
}
