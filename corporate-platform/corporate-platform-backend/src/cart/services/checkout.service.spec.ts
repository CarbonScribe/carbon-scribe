import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { PaymentService } from './payment.service';
import { ReservationService } from './reservation.service';
import { AuditService } from './audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CheckoutService', () => {
  let service: CheckoutService;

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    cart: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
    },
    credit: {
      update: jest.fn(),
    },
    creditReservation: {
      deleteMany: jest.fn(),
    },
  };

  const mockPaymentService = {
    processPayment: jest.fn(),
  };

  const mockReservationService = {
    reserveCredits: jest.fn().mockResolvedValue(undefined),
    releaseReservations: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logOrderEvent: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: ReservationService, useValue: mockReservationService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateCheckout', () => {
    it('should throw BadRequestException when cart is empty', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue(null);

      await expect(
        service.initiateCheckout('comp1', 'user1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when cart has no items', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        items: [],
      });

      await expect(
        service.initiateCheckout('comp1', 'user1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when credits are insufficient', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            credit: { available: 500, projectName: 'Solar Farm' },
          },
        ],
      });

      await expect(
        service.initiateCheckout('comp1', 'user1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create order successfully', async () => {
      mockPrisma.cart.findFirst.mockResolvedValue({
        id: 'cart1',
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            credit: { available: 5000, projectName: 'Solar Farm' },
          },
        ],
      });

      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.create.mockResolvedValue({
        id: 'order1',
        orderNumber: 'ORD-2026-0001',
        status: 'pending',
      });
      mockPrisma.orderItem.create.mockResolvedValue({});

      const result = await service.initiateCheckout('comp1', 'user1', {
        paymentMethod: 'credit_card',
      });

      expect(result.orderId).toBe('order1');
      expect(result.orderNumber).toBe('ORD-2026-0001');
      expect(result.status).toBe('pending');
    });
  });

  describe('confirmPurchase', () => {
    it('should throw NotFoundException when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmPurchase('nonexistent', 'comp1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order is not pending', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'comp1',
        status: 'completed',
        items: [],
      });

      await expect(service.confirmPurchase('order1', 'comp1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should complete purchase successfully', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'comp1',
        status: 'pending',
        paymentMethod: 'credit_card',
        total: 10500,
        cartId: 'cart1',
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            subtotal: 10000,
            credit: { available: 5000, projectName: 'Solar Farm' },
          },
        ],
      });

      mockPaymentService.processPayment.mockResolvedValue({
        paymentId: 'pay_123',
        status: 'approved',
        transactionHash: 'tx_abc',
      });

      mockPrisma.credit.update.mockResolvedValue({});
      mockPrisma.order.update.mockResolvedValue({
        id: 'order1',
        orderNumber: 'ORD-2026-0001',
        companyId: 'comp1',
        userId: 'user1',
        status: 'completed',
        subtotal: 10000,
        serviceFee: 500,
        total: 10500,
        paymentId: 'pay_123',
        paymentMethod: 'credit_card',
        transactionHash: 'tx_abc',
        paidAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: null,
        items: [
          {
            id: 'oi1',
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            subtotal: 10000,
            credit: { projectName: 'Solar Farm' },
          },
        ],
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue({});

      const result = await service.confirmPurchase('order1', 'comp1');

      expect(result.order.status).toBe('completed');
      expect(result.transactionHash).toBe('tx_abc');
      expect(mockPaymentService.processPayment).toHaveBeenCalled();
    });

    it('should fail order when payment is declined', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'comp1',
        status: 'pending',
        paymentMethod: 'credit_card',
        total: 10500,
        items: [
          {
            creditId: 'cred1',
            quantity: 1000,
            price: 10,
            credit: { available: 5000, projectName: 'Solar Farm' },
          },
        ],
      });

      mockPaymentService.processPayment.mockResolvedValue({
        paymentId: 'pay_123',
        status: 'declined',
      });

      mockPrisma.order.update.mockResolvedValue({});

      await expect(service.confirmPurchase('order1', 'comp1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
