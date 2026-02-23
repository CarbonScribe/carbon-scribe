import { Test, TestingModule } from '@nestjs/testing';
import { ComparisonService } from './comparison.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('ComparisonService', () => {
  let service: ComparisonService;
  let prisma: PrismaService;

  const mockPrismaService = {
    credit: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComparisonService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ComparisonService>(ComparisonService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('compareProjects', () => {
    it('should return performance data and benchmarks', async () => {
      const mockCredits = [
        { projectId: 'p1', projectName: 'P1', pricePerTon: 20, dynamicScore: 80, country: 'Kenya', methodology: 'REDD+' },
      ];
      mockPrismaService.credit.findMany.mockResolvedValue(mockCredits);
      mockPrismaService.credit.aggregate.mockResolvedValue({
        _avg: { pricePerTon: 18, dynamicScore: 75 },
      });

      const result = await service.compareProjects(['p1']);

      expect(result.performanceData).toHaveLength(1);
      expect(result.performanceData[0].name).toBe('P1');
      expect(result.methodologyBenchmarks).toHaveLength(1);
      expect(result.methodologyBenchmarks[0].methodology).toBe('REDD+');
    });
  });
});
