import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TransactionService', () => {
  let service: TransactionService;

  const mockPrisma = {
    transaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockTransaction = {
    id: 'tx-1',
    companyId: 'company-1',
    userId: 'user-1',
    type: 'order',
    orderId: 'order-1',
    amount: 10500,
    currency: 'USD',
    status: 'completed',
    metadata: null,
    createdAt: new Date('2026-01-15T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── getTransactions ──────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns paginated transaction list', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const result = await service.getTransactions('company-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('tx-1');
      expect(result.data[0].type).toBe('order');
    });

    it('filters by transaction type', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.getTransactions('company-1', { type: 'refund' });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'refund' }),
        }),
      );
    });

    it('filters by date range', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.getTransactions('company-1', {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
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

    it('always scopes results to companyId', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.getTransactions('company-1', {});

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-1' }),
        }),
      );
    });
  });

  // ── getTransactionById ───────────────────────────────────────────────

  describe('getTransactionById', () => {
    it('returns the correct transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById('company-1', 'tx-1');

      expect(result.id).toBe('tx-1');
      expect(result.amount).toBe(10500);
      expect(result.currency).toBe('USD');
    });

    it('throws NotFoundException when transaction is not found', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.getTransactionById('company-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for cross-company access', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        companyId: 'other-company',
      });

      await expect(
        service.getTransactionById('company-1', 'tx-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── exportCsv ────────────────────────────────────────────────────────

  describe('exportCsv', () => {
    it('returns a non-empty CSV string with headers', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);

      const csv = await service.exportCsv('company-1');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('ID');
      expect(csv).toContain('Type');
      expect(csv).toContain('Amount');
      expect(csv).toContain('tx-1');
      expect(csv).toContain('order');
    });

    it('returns CSV with header row only when no transactions exist', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv('company-1');

      expect(typeof csv).toBe('string');
      // Column headers are always present regardless of data
      expect(csv).toContain('ID');
      expect(csv).toContain('Type');
      // Only a header row — no data body
      const lines = csv.trim().split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
    });

    it('scopes CSV export to the correct company', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await service.exportCsv('company-1');

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1' },
        }),
      );
    });
  });
});
