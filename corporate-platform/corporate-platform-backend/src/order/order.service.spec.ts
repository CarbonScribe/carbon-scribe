import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../shared/database/prisma.service';

describe('OrderService', () => {
  let service: OrderService;

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
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

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        {
          id: '1',
          orderNumber: 'ORD-001',
          companyId: 'comp-1',
          status: 'completed',
          total: 100,
          items: [],
        },
      ];
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await service.findAll('comp-1', { page: 1, limit: 10 });

      expect(result).toEqual({
        data: mockOrders,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 10,
        status: 'completed',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1', status: 'completed' },
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: 'comp-1',
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31'),
            },
          },
        }),
      );
    });

    it('should search by order number', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 10,
        search: 'ORD-001',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: 'comp-1',
            orderNumber: { contains: 'ORD-001', mode: 'insensitive' },
          },
        }),
      );
    });

    it('should calculate correct pagination skip', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.findAll('comp-1', { page: 3, limit: 5 });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(23);

      const result = await service.findAll('comp-1', { page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  describe('findById', () => {
    it('should return an order with items and status events', async () => {
      const mockOrder = {
        id: '1',
        orderNumber: 'ORD-001',
        companyId: 'comp-1',
        items: [{ id: 'item-1', creditName: 'Carbon Credit A' }],
        statusEvents: [{ id: 'evt-1', status: 'pending' }],
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findById('1', 'comp-1');

      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.findFirst).toHaveBeenCalledWith({
        where: { id: '1', companyId: 'comp-1' },
        include: {
          items: true,
          statusEvents: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    it('should return null when order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      const result = await service.findById('nonexistent', 'comp-1');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return order statistics for completed orders', async () => {
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: 5000 },
        _count: { id: 10 },
        _avg: { total: 500 },
      });

      const result = await service.getStats('comp-1');

      expect(result).toEqual({
        totalSpent: 5000,
        orderCount: 10,
        avgOrderValue: 500,
      });
      expect(mockPrisma.order.aggregate).toHaveBeenCalledWith({
        where: { companyId: 'comp-1', status: 'completed' },
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      });
    });

    it('should handle zero orders', async () => {
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { total: null },
        _count: { id: 0 },
        _avg: { total: null },
      });

      const result = await service.getStats('comp-1');

      expect(result).toEqual({
        totalSpent: 0,
        orderCount: 0,
        avgOrderValue: 0,
      });
    });
  });
});
