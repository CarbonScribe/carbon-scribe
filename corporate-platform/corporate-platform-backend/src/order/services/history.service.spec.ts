import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('HistoryService', () => {
  let service: HistoryService;

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockOrder = {
    id: 'order-1',
    orderNumber: 'ORD-2026-0001',
    companyId: 'company-1',
    userId: 'user-1',
    subtotal: 10000,
    serviceFee: 500,
    total: 10500,
    status: 'completed',
    paymentMethod: 'credit_card',
    paymentId: 'pay_abc',
    paidAt: new Date('2026-01-15'),
    transactionHash: 'tx_hash_001',
    notes: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    completedAt: new Date('2026-01-15'),
    items: [
      {
        id: 'item-1',
        creditId: 'credit-1',
        quantity: 1000,
        price: 10,
        subtotal: 10000,
        credit: { projectName: 'Solar Farm Kenya' },
      },
    ],
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

  // ── getOrders ──────────────────────────────────────────────────────────

  describe('getOrders', () => {
    it('returns paginated order list', async () => {
      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await service.getOrders('company-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data[0].orderNumber).toBe('ORD-2026-0001');
      expect(result.data[0].items[0].projectName).toBe('Solar Farm Kenya');
    });

    it('filters by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('company-1', { status: 'completed' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-1',
            status: 'completed',
          }),
        }),
      );
    });

    it('filters by date range', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('company-1', {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('filters by orderNumber (case-insensitive search)', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('company-1', { orderNumber: 'ORD-2026' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderNumber: { contains: 'ORD-2026', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('applies custom sort direction', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('company-1', {
        sortBy: 'total',
        sortOrder: 'asc',
      });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { total: 'asc' },
        }),
      );
    });

    it('applies pagination skip correctly', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await service.getOrders('company-1', { page: 3, limit: 5 });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  // ── getOrderById ───────────────────────────────────────────────────────

  describe('getOrderById', () => {
    it('returns order detail with items', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('company-1', 'order-1');

      expect(result.id).toBe('order-1');
      expect(result.orderNumber).toBe('ORD-2026-0001');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].projectName).toBe('Solar Farm Kenya');
    });

    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById('company-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when order belongs to a different company', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        companyId: 'other-company',
      });

      await expect(
        service.getOrderById('company-1', 'order-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns correct aggregated statistics', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { total: 10000, status: 'completed' },
        { total: 5000, status: 'completed' },
        { total: 2000, status: 'failed' },
      ]);

      const stats = await service.getStats('company-1');

      expect(stats.totalSpent).toBe(17000);
      expect(stats.orderCount).toBe(3);
      expect(stats.avgOrderValue).toBeCloseTo(5666.67, 1);
      expect(stats.byStatus.completed).toBe(2);
      expect(stats.byStatus.failed).toBe(1);
    });

    it('returns zeros when no orders exist', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      const stats = await service.getStats('company-1');

      expect(stats.totalSpent).toBe(0);
      expect(stats.orderCount).toBe(0);
      expect(stats.avgOrderValue).toBe(0);
    });
  });

  // ── toOrderDetail ──────────────────────────────────────────────────────

  describe('toOrderDetail', () => {
    it('maps all fields correctly', () => {
      const detail = service.toOrderDetail(mockOrder);

      expect(detail.id).toBe(mockOrder.id);
      expect(detail.status).toBe('completed');
      expect(detail.items[0].creditId).toBe('credit-1');
      expect(detail.items[0].quantity).toBe(1000);
    });

    it('handles missing credit gracefully', () => {
      const orderWithNullCredit = {
        ...mockOrder,
        items: [{ ...mockOrder.items[0], credit: null }],
      };
      const detail = service.toOrderDetail(orderWithNullCredit);
      expect(detail.items[0].projectName).toBe('');
    });
  });
});
