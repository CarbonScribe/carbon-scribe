import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CheckoutService } from './services/checkout.service';
import { PaymentService } from './services/payment.service';
import { ReservationService } from './services/reservation.service';
import { AuditService } from './services/audit.service';
import { RetirementModule } from '../retirement/retirement.module';

@Module({
  imports: [RetirementModule],
  providers: [
    CartService,
    CheckoutService,
    PaymentService,
    ReservationService,
    AuditService,
  ],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
