import { Test, TestingModule } from '@nestjs/testing';
import { CompositionService } from './composition.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('CompositionService', () => {
  let service: CompositionService;

  const mockPrismaService = {
    portfolio: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompositionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CompositionService>(CompositionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCompositionMetrics', () => {
    it('should return empty composition if no portfolio', async () => {
      mockPrismaService.portfolio.findUnique.mockResolvedValue(null);

      const result = await service.getCompositionMetrics('test-company-id');

      expect(result.methodologyDistribution).toEqual([]);
      expect(result.geographicAllocation).toEqual([]);
      expect(result.sdgImpact).toEqual([]);
    });

    it('should calculate methodology distribution correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, credit: { methodology: 'REDD+' } },
          { quantity: 100, credit: { methodology: 'Solar' } },
          { quantity: 200, credit: { methodology: 'REDD+' } },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getCompositionMetrics('test-company-id');

      expect(result.methodologyDistribution.length).toBe(2);
      expect(result.methodologyDistribution[0].name).toBe('REDD+');
      expect(result.methodologyDistribution[0].value).toBe(300);
      expect(result.methodologyDistribution[0].percentage).toBeCloseTo(75, 1);
    });

    it('should calculate geographic allocation correctly', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, credit: { country: 'Brazil' } },
          { quantity: 300, credit: { country: 'Indonesia' } },
          { quantity: 100, credit: { country: 'Brazil' } },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getCompositionMetrics('test-company-id');

      expect(result.geographicAllocation.length).toBe(2);
      expect(result.geographicAllocation[0].name).toBe('Indonesia');
      expect(result.geographicAllocation[0].percentage).toBeCloseTo(60, 1);
    });

    it('should calculate SDG distribution and total to 100%', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, credit: { sdgs: 'SDG 1, SDG 2' } },
          { quantity: 100, credit: { sdgs: 'SDG 2, SDG 3' } },
          { quantity: 100, credit: { sdgs: null } },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getCompositionMetrics('test-company-id');

      const sdgTotal = result.sdgImpact.reduce(
        (sum, sdg) => sum + sdg.percentage,
        0,
      );
      expect(sdgTotal).toBeCloseTo(100, 0);
    });

    it('should calculate vintage year distribution', async () => {
      const mockPortfolio = {
        id: 'portfolio-1',
        holdings: [
          { quantity: 100, credit: { vintageYear: 2020 } },
          { quantity: 150, credit: { vintageYear: 2021 } },
          { quantity: 50, credit: { vintageYear: 2020 } },
        ],
      };

      mockPrismaService.portfolio.findUnique.mockResolvedValue(mockPortfolio);

      const result = await service.getCompositionMetrics('test-company-id');

      expect(result.vintageYearDistribution.length).toBe(2);
      expect(result.vintageYearDistribution[0].name).toBe('2021');
      expect(result.vintageYearDistribution[1].percentage).toBeCloseTo(50, 1);
    });
  });
});
