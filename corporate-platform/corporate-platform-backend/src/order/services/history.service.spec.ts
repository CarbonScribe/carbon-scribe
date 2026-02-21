import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('HistoryService', () => {
  let service: HistoryService;

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrderHistory', () => {
    it('should return paginated order history', async () => {
      const mockOrders = [
        { id: '1', orderNumber: 'ORD-001', items: [] },
        { id: '2', orderNumber: 'ORD-002', items: [] },
      ];
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(2);

      const result = await service.getOrderHistory('comp-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });

    it('should apply status filter', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrderHistory('comp-1', {
        page: 1,
        limit: 10,
        status: 'pending',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should apply search filter on order number', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrderHistory('comp-1', {
        page: 1,
        limit: 10,
        search: 'ORD-100',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderNumber: { contains: 'ORD-100', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrderHistory('comp-1', {
        page: 1,
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-06-30',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-06-30'),
            },
          }),
        }),
      );
    });

    it('should sort by specified field and order', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrderHistory('comp-1', {
        page: 1,
        limit: 10,
        sortBy: 'total',
        sortOrder: 'asc',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total: 'asc' },
        }),
      );
    });
  });
});
