import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AddToCartDto } from '../dto/add-to-cart.dto';
import { UpdateCartDto } from '../dto/update-cart.dto';
import {
  SERVICE_FEE_RATE,
  CART_EXPIRY_DAYS,
  DEFAULT_QUANTITY,
  CartDetails,
} from '../interfaces/cart.interface';
import { ReservationService } from './reservation.service';

@Injectable()
export class CartCrudService {
  constructor(
    private prisma: PrismaService,
    private reservationService: ReservationService,
  ) {}

  async getOrCreateCart(companyId: string): Promise<CartDetails> {
    // Find existing active cart for this company
    let cart = await this.prisma.cart.findFirst({
      where: {
        companyId,
        expiresAt: { gt: new Date() },
      },
      include: {
        items: {
          include: { credit: true },
        },
      },
    });

    if (!cart) {
      // Create a new cart
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CART_EXPIRY_DAYS);

      cart = await this.prisma.cart.create({
        data: {
          companyId,
          sessionId: this.generateSessionId(),
          expiresAt,
        },
        include: {
          items: {
            include: { credit: true },
          },
        },
      });
    }

    return this.toCartDetails(cart);
  }

  async addItem(companyId: string, dto: AddToCartDto): Promise<CartDetails> {
    const quantity = dto.quantity ?? DEFAULT_QUANTITY;

    // 1. Check credit exists and is available
    const credit = await this.prisma.credit.findUnique({
      where: { id: dto.creditId },
    });

    if (!credit) {
      throw new NotFoundException(`Credit with ID ${dto.creditId} not found`);
    }

    if (credit.available < quantity) {
      throw new BadRequestException(
        `Insufficient credits available. Requested: ${quantity}, Available: ${credit.available}`,
      );
    }

    // 2. Get or create cart
    const cart = await this.getOrCreateCartRecord(companyId);

    // 3. Check if item already exists in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_creditId: {
          cartId: cart.id,
          creditId: dto.creditId,
        },
      },
    });

    if (existingItem) {
      throw new BadRequestException(
        'This credit is already in your cart. Use update to change quantity.',
      );
    }

    // 4. Add item to cart with real credit price
    await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        creditId: dto.creditId,
        quantity,
        price: credit.price > 0 ? credit.price : 10.0, // Fall back to $10 if price not set
      },
    });

    // 5. Recalculate totals and refresh expiry
    await this.recalculateTotals(cart.id);
    await this.refreshExpiry(cart.id);

    return this.getCart(companyId);
  }

  async updateItem(
    companyId: string,
    itemId: string,
    dto: UpdateCartDto,
  ): Promise<CartDetails> {
    // 1. Find the cart item
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true, credit: true },
    });

    if (!cartItem || cartItem.cart.companyId !== companyId) {
      throw new NotFoundException('Cart item not found');
    }

    // 2. Check credit availability for new quantity
    if (cartItem.credit.available < dto.quantity) {
      throw new BadRequestException(
        `Insufficient credits available. Requested: ${dto.quantity}, Available: ${cartItem.credit.available}`,
      );
    }

    // 3. Update quantity
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    // 4. Recalculate totals
    await this.recalculateTotals(cartItem.cartId);

    return this.getCart(companyId);
  }

  async removeItem(companyId: string, itemId: string): Promise<CartDetails> {
    // 1. Find the cart item
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.companyId !== companyId) {
      throw new NotFoundException('Cart item not found');
    }

    // 2. Delete the item
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    // 3. Recalculate totals
    await this.recalculateTotals(cartItem.cartId);

    // 4. Release any existing reservations (cart contents changed)
    await this.reservationService.releaseReservations(cartItem.cartId);

    return this.getCart(companyId);
  }

  async clearCart(companyId: string): Promise<{ success: boolean }> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        companyId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!cart) {
      return { success: true };
    }

    // Release reservations before clearing items
    await this.reservationService.releaseReservations(cart.id);

    // Delete all items and reset totals
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotal: 0,
        serviceFee: 0,
        total: 0,
      },
    });

    return { success: true };
  }

  async getCart(companyId: string): Promise<CartDetails> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        companyId,
        expiresAt: { gt: new Date() },
      },
      include: {
        items: {
          include: { credit: true },
        },
      },
    });

    if (!cart) {
      // Return empty cart structure
      return {
        id: '',
        companyId,
        sessionId: '',
        items: [],
        subtotal: 0,
        serviceFee: 0,
        total: 0,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return this.toCartDetails(cart);
  }

  async recalculateTotals(cartId: string): Promise<void> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
    });

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const serviceFee = subtotal * SERVICE_FEE_RATE;
    const total = subtotal + serviceFee;

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { subtotal, serviceFee, total },
    });
  }

  async cleanupExpiredCarts(): Promise<number> {
    const result = await this.prisma.cart.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }

  private async getOrCreateCartRecord(companyId: string) {
    let cart = await this.prisma.cart.findFirst({
      where: {
        companyId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!cart) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CART_EXPIRY_DAYS);

      cart = await this.prisma.cart.create({
        data: {
          companyId,
          sessionId: this.generateSessionId(),
          expiresAt,
        },
      });
    }

    return cart;
  }

  private async refreshExpiry(cartId: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CART_EXPIRY_DAYS);

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { expiresAt },
    });
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private toCartDetails(cart: any): CartDetails {
    return {
      id: cart.id,
      companyId: cart.companyId,
      sessionId: cart.sessionId,
      items: (cart.items || []).map((item: any) => ({
        id: item.id,
        creditId: item.creditId,
        projectName: item.credit?.projectName || '',
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        createdAt: item.createdAt,
      })),
      subtotal: cart.subtotal,
      serviceFee: cart.serviceFee,
      total: cart.total,
      expiresAt: cart.expiresAt,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
