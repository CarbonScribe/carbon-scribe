import { OrderStatus } from '@prisma/client';

export interface IOrderItem {
  id: string;
  creditId: string;
  creditName: string;
  projectName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vintage?: string;
  verificationStandard?: string;
}

export interface IOrderStatusEvent {
  id: string;
  status: OrderStatus;
  message?: string;
  createdAt: Date;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  companyId: string;
  userId: string;
  status: OrderStatus;
  subtotal: number;
  serviceFee: number;
  total: number;
  paymentMethod?: string;
  transactionHash?: string;
  paidAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  items?: IOrderItem[];
  statusEvents?: IOrderStatusEvent[];
}

export interface IPaginatedOrders {
  data: IOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IOrderStats {
  totalSpent: number;
  orderCount: number;
  avgOrderValue: number;
  completedOrders: number;
  pendingOrders: number;
}
