import { OrderDetails } from './order.interface';

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  status: string;
}

export interface ConfirmResult {
  order: OrderDetails;
  transactionHash?: string;
}

export interface PaymentResult {
  paymentId: string;
  status: 'approved' | 'declined' | 'pending';
  transactionHash?: string;
}
