import { Test, TestingModule } from '@nestjs/testing';
import { DetailsService } from './details.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('DetailsService', () => {
  let service: DetailsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    credit: {
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DetailsService>(DetailsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a credit if found', async () => {
      const mockCredit = { id: '1', projectName: 'Test' };
      mockPrismaService.credit.findUnique.mockResolvedValue(mockCredit);

      const result = await service.findOne('1');
      expect(result).toEqual(mockCredit);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.credit.findUnique.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return marketplace statistics', async () => {
      mockPrismaService.credit.aggregate.mockResolvedValue({
        _sum: { availableAmount: 1000 },
        _avg: { pricePerTon: 25 },
        _count: { id: 5 },
      });
      mockPrismaService.credit.groupBy.mockResolvedValue([
        { methodology: 'VERRA', _count: { id: 3 } },
        { methodology: 'GS', _count: { id: 2 } },
      ]);

      const result = await service.getStats();

      expect(result.totalAvailable).toBe(1000);
      expect(result.averagePrice).toBe(25);
      expect(result.projectCount).toBe(5);
      expect(result.methodologyBreakdown).toEqual({ VERRA: 3, GS: 2 });
    });
  });
});
