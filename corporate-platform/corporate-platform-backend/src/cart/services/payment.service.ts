import { Injectable } from '@nestjs/common';
import { PaymentResult } from '../interfaces/checkout.interface';

@Injectable()
export class PaymentService {
  /**
   * Process a payment for an order.
   * This is a stub implementation that always returns success.
   * Replace with actual payment gateway integration (Stripe, etc.)
   */
  async processPayment(
    orderId: string,
    method: string,
    amount: number,
  ): Promise<PaymentResult> {
    // Simulate payment processing delay
    await this.simulateDelay(500);

    // Stub: always approve
    // In production, use `method` and `amount` to call the payment gateway
    void method;
    void amount;

    return {
      paymentId: `pay_${orderId}_${Date.now()}`,
      status: 'approved',
      transactionHash: `tx_${Math.random().toString(36).substring(2, 10)}`,
    };
  }

  /**
   * Refund a payment.
   * Stub implementation.
   */
  async refundPayment(
    paymentId: string,
  ): Promise<{ success: boolean; refundId: string }> {
    await this.simulateDelay(300);

    return {
      success: true,
      refundId: `ref_${paymentId}_${Date.now()}`,
    };
  }

  /**
   * Check payment status.
   * Stub implementation.
   */
  async getPaymentStatus(
    paymentId: string,
  ): Promise<{ paymentId: string; status: string }> {
    return {
      paymentId,
      status: 'approved',
    };
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
