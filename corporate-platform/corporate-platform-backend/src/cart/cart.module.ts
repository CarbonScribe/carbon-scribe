import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { CartCrudService } from './services/cart-crud.service';
import { CheckoutService } from './services/checkout.service';
import { OrderService } from './services/order.service';
import { PaymentService } from './services/payment.service';

@Module({
  providers: [
    CartService,
    CartCrudService,
    CheckoutService,
    OrderService,
    PaymentService,
  ],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
