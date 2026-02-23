import { CartItemDetails } from './cart-item.interface';

export interface CartDetails {
  id: string;
  companyId: string;
  sessionId: string;
  items: CartItemDetails[];
  subtotal: number;
  serviceFee: number;
  total: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const SERVICE_FEE_RATE = 0.05; // 5% service fee
export const CART_EXPIRY_DAYS = 7;
export const DEFAULT_QUANTITY = 1000; // Standard lot size in tCO₂
export const RESERVATION_MINUTES = 15; // Credit reservation hold time
