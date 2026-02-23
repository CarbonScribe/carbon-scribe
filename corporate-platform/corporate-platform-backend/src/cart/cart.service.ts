import { Injectable } from '@nestjs/common';
import { CartCrudService } from './services/cart-crud.service';
import { CheckoutService } from './services/checkout.service';
import { OrderService } from './services/order.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CheckoutDto, OrderQueryDto } from './dto/checkout.dto';
import { Response } from 'express';

@Injectable()
export class CartService {
  constructor(
    private cartCrudService: CartCrudService,
    private checkoutService: CheckoutService,
    private orderService: OrderService,
  ) {}

  // Cart CRUD operations
  getCart(companyId: string) {
    return this.cartCrudService.getCart(companyId);
  }

  addItem(companyId: string, dto: AddToCartDto) {
    return this.cartCrudService.addItem(companyId, dto);
  }

  updateItem(companyId: string, itemId: string, dto: UpdateCartDto) {
    return this.cartCrudService.updateItem(companyId, itemId, dto);
  }

  removeItem(companyId: string, itemId: string) {
    return this.cartCrudService.removeItem(companyId, itemId);
  }

  clearCart(companyId: string) {
    return this.cartCrudService.clearCart(companyId);
  }

  // Checkout operations
  checkout(companyId: string, userId: string, dto: CheckoutDto) {
    return this.checkoutService.initiateCheckout(companyId, userId, dto);
  }

  confirmPurchase(orderId: string, companyId: string) {
    return this.checkoutService.confirmPurchase(orderId, companyId);
  }

  // Order operations
  getOrders(companyId: string, query: OrderQueryDto) {
    return this.orderService.getOrders(companyId, query);
  }

  getOrderById(companyId: string, orderId: string) {
    return this.orderService.getOrderById(companyId, orderId);
  }

  generateInvoice(companyId: string, orderId: string, res: Response) {
    return this.orderService.generateInvoice(companyId, orderId, res);
  }
}
