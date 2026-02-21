import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('TransactionService', () => {
  let service: TransactionService;

  const mockPrisma = {
    transaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
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

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: '1', type: 'purchase', amount: 500, companyId: 'comp-1' },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll('comp-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by type', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 10,
        type: 'retirement',
      });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1', type: 'retirement' },
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 10,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
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
  });

  describe('findById', () => {
    it('should return a transaction by id', async () => {
      const mockTransaction = {
        id: '1',
        type: 'purchase',
        amount: 500,
      };
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.findById('1', 'comp-1');

      expect(result).toEqual(mockTransaction);
    });

    it('should return null when not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      const result = await service.findById('nonexistent', 'comp-1');

      expect(result).toBeNull();
    });
  });

  describe('exportCsv', () => {
    it('should generate CSV string with headers and data', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          type: 'purchase',
          amount: 500,
          description: 'Carbon credit purchase',
          transactionHash: '0xabc',
          orderId: 'order-1',
          retirementId: null,
          createdAt: new Date('2024-03-15T10:00:00Z'),
        },
        {
          id: 'txn-2',
          type: 'retirement',
          amount: 200,
          description: 'Credit retirement, batch "A"',
          transactionHash: null,
          orderId: null,
          retirementId: 'ret-1',
          createdAt: new Date('2024-03-16T12:00:00Z'),
        },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const csv = await service.exportCsv('comp-1');

      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'ID,Type,Amount,Description,Transaction Hash,Order ID,Retirement ID,Created At',
      );
      expect(lines).toHaveLength(3);
      expect(lines[1]).toContain('txn-1');
      expect(lines[1]).toContain('purchase');
      // Verify CSV escaping of descriptions with commas/quotes
      expect(lines[2]).toContain('"Credit retirement, batch ""A"""');
    });

    it('should return only headers when no transactions exist', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv('comp-1');

      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
    });
  });
});
