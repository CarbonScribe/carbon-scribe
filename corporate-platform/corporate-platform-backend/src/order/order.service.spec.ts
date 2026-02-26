import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('OrderService', () => {
  let service: OrderService;

  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
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

  describe('findById', () => {
    it('should return order with items and events', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        companyId: 'comp-1',
        status: 'COMPLETED',
        items: [{ id: 'item-1', creditName: 'Carbon Credit A' }],
        statusEvents: [{ id: 'event-1', status: 'PENDING' }],
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findById('order-1', 'comp-1');
      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-1', companyId: 'comp-1' },
        include: {
          items: true,
          statusEvents: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.findById('missing', 'comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('should return order statistics', async () => {
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: 5000 },
        _count: { id: 10 },
        _avg: { total: 500 },
      });
      mockPrisma.order.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { id: 8 } },
        { status: 'PENDING', _count: { id: 2 } },
      ]);

      const result = await service.getStats('comp-1');
      expect(result.totalSpent).toBe(5000);
      expect(result.orderCount).toBe(10);
      expect(result.avgOrderValue).toBe(500);
      expect(result.completedOrders).toBe(8);
      expect(result.pendingOrders).toBe(2);
    });

    it('should handle no orders', async () => {
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: null },
        _count: { id: 0 },
        _avg: { total: null },
      });
      mockPrisma.order.groupBy.mockResolvedValue([]);

      const result = await service.getStats('comp-1');
      expect(result.totalSpent).toBe(0);
      expect(result.orderCount).toBe(0);
      expect(result.avgOrderValue).toBe(0);
    });
  });
});
