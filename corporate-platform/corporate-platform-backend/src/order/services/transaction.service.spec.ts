import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TransactionService', () => {
  let service: TransactionService;

  const mockPrisma = {
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
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
      const mockTransactions = [{ id: 't1', type: 'PURCHASE', amount: 100 }];
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll('comp-1', { page: 1, limit: 10 });
      expect(result.data).toEqual(mockTransactions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should apply type filter', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 10,
        type: 'PURCHASE' as any,
      });

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'PURCHASE' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return transaction by id', async () => {
      const mockTx = { id: 't1', type: 'PURCHASE', amount: 100 };
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTx);

      const result = await service.findById('t1', 'comp-1');
      expect(result).toEqual(mockTx);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);
      await expect(service.findById('missing', 'comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exportCsv', () => {
    it('should generate CSV string', async () => {
      const mockTransactions = [
        {
          id: 't1',
          type: 'PURCHASE',
          amount: 100,
          description: 'Carbon credits purchase',
          transactionHash: '0xabc',
          createdAt: new Date('2024-06-15'),
        },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.exportCsv('comp-1');
      expect(result).toContain('ID,Type,Amount,Description');
      expect(result).toContain('t1');
      expect(result).toContain('PURCHASE');
      expect(result).toContain('0xabc');
    });

    it('should handle empty transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      const result = await service.exportCsv('comp-1');
      expect(result).toContain('ID,Type,Amount');
      const lines = result.split('\n');
      expect(lines).toHaveLength(1); // header only
    });
  });
});
