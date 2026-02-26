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

  it('should return paginated orders', async () => {
    const mockOrders = [
      { id: '1', orderNumber: 'ORD-001', total: 100 },
      { id: '2', orderNumber: 'ORD-002', total: 200 },
    ];
    mockPrisma.order.findMany.mockResolvedValue(mockOrders);
    mockPrisma.order.count.mockResolvedValue(2);

    const result = await service.getOrders('comp-1', { page: 1, limit: 10 });
    expect(result.data).toEqual(mockOrders);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('should calculate totalPages correctly', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(25);

    const result = await service.getOrders('comp-1', { page: 1, limit: 10 });
    expect(result.totalPages).toBe(3);
  });

  it('should apply status filter', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);

    await service.getOrders('comp-1', {
      page: 1,
      limit: 10,
      status: 'COMPLETED' as any,
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('should apply date range filter', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);

    await service.getOrders('comp-1', {
      page: 1,
      limit: 10,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
        }),
      }),
    );
  });

  it('should apply search filter on orderNumber', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);

    await service.getOrders('comp-1', {
      page: 1,
      limit: 10,
      search: 'ORD-001',
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderNumber: { contains: 'ORD-001', mode: 'insensitive' },
        }),
      }),
    );
  });
});
