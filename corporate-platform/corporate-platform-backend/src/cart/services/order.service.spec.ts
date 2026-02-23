import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('OrderService', () => {
  let service: OrderService;

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        {
          id: 'order1',
          orderNumber: 'ORD-2026-0001',
          companyId: 'comp1',
          userId: 'user1',
          subtotal: 10000,
          serviceFee: 500,
          total: 10500,
          status: 'completed',
          paymentMethod: 'credit_card',
          paymentId: 'pay_123',
          paidAt: new Date(),
          transactionHash: 'tx_abc',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: new Date(),
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
        },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await service.getOrders('comp1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.data[0].orderNumber).toBe('ORD-2026-0001');
      expect(result.data[0].items[0].projectName).toBe('Solar Farm');
    });

    it('should filter by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('comp1', {
        status: 'completed',
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp1',
            status: 'completed',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('comp1', {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp1',
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should return empty list when no orders', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      const result = await service.getOrders('comp1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getOrderById', () => {
    it('should return order details', async () => {
      const mockOrder = {
        id: 'order1',
        orderNumber: 'ORD-2026-0001',
        companyId: 'comp1',
        userId: 'user1',
        subtotal: 10000,
        serviceFee: 500,
        total: 10500,
        status: 'completed',
        paymentMethod: 'credit_card',
        paymentId: 'pay_123',
        paidAt: new Date(),
        transactionHash: 'tx_abc',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
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
        company: { name: 'Test Corp' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('comp1', 'order1');

      expect(result.id).toBe('order1');
      expect(result.orderNumber).toBe('ORD-2026-0001');
      expect(result.items).toHaveLength(1);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById('comp1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when order belongs to different company', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order1',
        companyId: 'other-company',
      });

      await expect(service.getOrderById('comp1', 'order1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
