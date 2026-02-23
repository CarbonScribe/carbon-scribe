import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import {
  CheckoutDto,
  ConfirmCheckoutDto,
  OrderQueryDto,
} from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class CartController {
  constructor(private cartService: CartService) {}

  // ==========================================
  // Cart Endpoints
  // ==========================================

  @Get('cart')
  async getCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.getCart(user.companyId);
  }

  @Post('cart/items')
  async addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(user.companyId, dto);
  }

  @Put('cart/items/:itemId')
  async updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartDto,
  ) {
    return this.cartService.updateItem(user.companyId, itemId, dto);
  }

  @Delete('cart/items/:itemId')
  async removeItem(
    @CurrentUser() user: JwtPayload,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeItem(user.companyId, itemId);
  }

  @Delete('cart')
  async clearCart(@CurrentUser() user: JwtPayload) {
    return this.cartService.clearCart(user.companyId);
  }

  // ==========================================
  // Checkout Endpoints
  // ==========================================

  @Post('cart/checkout')
  async checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    return this.cartService.checkout(user.companyId, user.sub, dto);
  }

  @Post('checkout/confirm')
  async confirmPurchase(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmCheckoutDto,
  ) {
    return this.cartService.confirmPurchase(dto.orderId, user.companyId);
  }

  // ==========================================
  // Order Endpoints
  // ==========================================

  @Get('orders')
  async getOrders(
    @CurrentUser() user: JwtPayload,
    @Query() query: OrderQueryDto,
  ) {
    return this.cartService.getOrders(user.companyId, query);
  }

  @Get('orders/:id')
  async getOrderById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cartService.getOrderById(user.companyId, id);
  }

  @Get('orders/:id/invoice')
  async getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.cartService.generateInvoice(user.companyId, id, res);
  }
}
