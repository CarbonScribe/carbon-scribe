import { Test, TestingModule } from '@nestjs/testing';
import { CartCrudService } from './cart-crud.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { ReservationService } from './reservation.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CartCrudService', () => {
  let service: CartCrudService;

  const mockPrisma = {
    cart: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    cartItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    credit: {
      findUnique: jest.fn(),
    },
  };

  const mockReservationService = {
    reserveCredits: jest.fn().mockResolvedValue(undefined),
    releaseReservations: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartCrudService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReservationService, useValue: mockReservationService },
      ],
    }).compile();

    service = module.get<CartCrudService>(CartCrudService);
    // PrismaService is injected via mockPrisma

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCart', () => {
    it('should return empty cart when no active cart exists', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      const result = await service.getCart('comp1');

      expect(result.items).toEqual([]);
      expect(result.subtotal).toBe(0);
      expect(result.serviceFee).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should return cart with items when active cart exists', async () => {
      const mockCart = {
        id: 'cart1',
        companyId: 'comp1',
        sessionId: 'sess_123',
        subtotal: 10000,
        serviceFee: 500,
        total: 10500,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item1',
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            createdAt: new Date(),
            credit: { projectName: 'Solar Farm' },
          },
        ],
      };

      mockPrisma.cart.findFirst.mockResolvedValue(mockCart);

      const result = await service.getCart('comp1');

      expect(result.id).toBe('cart1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].projectName).toBe('Solar Farm');
      expect(result.items[0].subtotal).toBe(10000);
      expect(result.subtotal).toBe(10000);
    });
  });

  describe('addItem', () => {
    it('should throw NotFoundException when credit does not exist', async () => {
      mockPrisma.credit.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem('comp1', { creditId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when insufficient credits', async () => {
      mockPrisma.credit.findUnique.mockResolvedValue({
        id: 'cred1',
        available: 500,
      });

      await expect(
        service.addItem('comp1', { creditId: 'cred1', quantity: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when item already in cart', async () => {
      mockPrisma.credit.findUnique.mockResolvedValue({
        id: 'cred1',
        available: 5000,
      });

      // Cart exists
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        companyId: 'comp1',
      });

      // Item already exists
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        creditId: 'cred1',
      });

      await expect(
        service.addItem('comp1', { creditId: 'cred1', quantity: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add item to cart successfully', async () => {
      mockPrisma.credit.findUnique.mockResolvedValue({
        id: 'cred1',
        available: 5000,
        projectName: 'Solar Farm',
      });

      // No existing cart
      mockPrisma.cart.findFirst
        .mockResolvedValueOnce({
          id: 'cart1',
          companyId: 'comp1',
        })
        .mockResolvedValueOnce({
          id: 'cart1',
          companyId: 'comp1',
          sessionId: 'sess_123',
          subtotal: 10000,
          serviceFee: 500,
          total: 10500,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [
            {
              id: 'item1',
              creditId: 'cred1',
              quantity: 1000,
              price: 10,
              createdAt: new Date(),
              credit: { projectName: 'Solar Farm' },
            },
          ],
        });

      // Item doesn't exist yet
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);

      // Create item
      mockPrisma.cartItem.create.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        creditId: 'cred1',
        quantity: 1000,
        price: 10,
      });

      // For recalculateTotals
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { price: 10, quantity: 1000 },
      ]);

      mockPrisma.cart.update.mockResolvedValue({});

      const result = await service.addItem('comp1', {
        creditId: 'cred1',
        quantity: 1000,
      });

      expect(mockPrisma.cartItem.create).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });
  });

  describe('recalculateTotals', () => {
    it('should calculate subtotal, service fee, and total correctly', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([
        { price: 10, quantity: 1000 },
        { price: 15, quantity: 500 },
      ]);

      mockPrisma.cart.update.mockResolvedValue({});

      await service.recalculateTotals('cart1');

      // subtotal = (10 * 1000) + (15 * 500) = 10000 + 7500 = 17500
      // serviceFee = 17500 * 0.05 = 875
      // total = 17500 + 875 = 18375
      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart1' },
        data: {
          subtotal: 17500,
          serviceFee: 875,
          total: 18375,
        },
      });
    });

    it('should handle empty cart correctly', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([]);
      mockPrisma.cart.update.mockResolvedValue({});

      await service.recalculateTotals('cart1');

      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart1' },
        data: {
          subtotal: 0,
          serviceFee: 0,
          total: 0,
        },
      });
    });
  });

  describe('removeItem', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('comp1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item belongs to different company', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: 'item1',
        cart: { companyId: 'other-company' },
      });

      await expect(service.removeItem('comp1', 'item1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove item and recalculate totals', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        cart: { companyId: 'comp1' },
      });

      mockPrisma.cartItem.delete.mockResolvedValue({});
      mockPrisma.cartItem.findMany.mockResolvedValue([]);
      mockPrisma.cart.update.mockResolvedValue({});
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await service.removeItem('comp1', 'item1');

      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item1' },
      });
    });
  });

  describe('clearCart', () => {
    it('should return success when no active cart', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      const result = await service.clearCart('comp1');

      expect(result).toEqual({ success: true });
    });

    it('should delete all items and reset totals', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        companyId: 'comp1',
      });

      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.cart.update.mockResolvedValue({});

      const result = await service.clearCart('comp1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart1' },
      });
      expect(mockPrisma.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart1' },
        data: { subtotal: 0, serviceFee: 0, total: 0 },
      });
    });
  });

  describe('cleanupExpiredCarts', () => {
    it('should delete expired carts', async () => {
      mockPrisma.cart.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredCarts();

      expect(result).toBe(5);
      expect(mockPrisma.cart.deleteMany).toHaveBeenCalled();
    });
  });
});
