import { Test, TestingModule } from '@nestjs/testing';
import { ImpactMetricsService } from './impact-metrics.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('ImpactMetricsService', () => {
  let service: ImpactMetricsService;

  const mockPrismaService = {
    retirement: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpactMetricsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ImpactMetricsService>(ImpactMetricsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate correct impact metrics for known CO2 offset', async () => {
    mockPrismaService.retirement.aggregate.mockResolvedValue({
      _sum: { amount: 100 },
    });

    const result = await service.getImpactMetrics('company-1');

    expect(result.co2Offset).toBe(100);
    // Trees: 100 tonnes = 100,000 kg / 22 kg/tree = 4545
    expect(result.treesPlanted).toBe(Math.round((100 * 1000) / 22));
    // Cars: 100 / 4.6 = 21.74
    expect(result.carsRemoved).toBe(Math.round((100 / 4.6) * 100) / 100);
    // Homes: 100 / 7.5 = 13.33
    expect(result.homesPowered).toBe(Math.round((100 / 7.5) * 100) / 100);
  });

  it('should return zeros when no retirements exist', async () => {
    mockPrismaService.retirement.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getImpactMetrics('company-1');

    expect(result.co2Offset).toBe(0);
    expect(result.treesPlanted).toBe(0);
    expect(result.carsRemoved).toBe(0);
    expect(result.homesPowered).toBe(0);
  });

  it('should include calculation standard', async () => {
    mockPrismaService.retirement.aggregate.mockResolvedValue({
      _sum: { amount: 50 },
    });

    const result = await service.getImpactMetrics('company-1');

    expect(result.calculationStandard).toBe('GHG Protocol Corporate Standard');
  });

  it('should apply date range filtering', async () => {
    mockPrismaService.retirement.aggregate.mockResolvedValue({
      _sum: { amount: 25 },
    });

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-06-30');

    await service.getImpactMetrics('company-1', startDate, endDate);

    expect(mockPrismaService.retirement.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          retiredAt: { gte: startDate, lte: endDate },
        }),
      }),
    );
  });

  it('should handle large CO2 offset values correctly', async () => {
    mockPrismaService.retirement.aggregate.mockResolvedValue({
      _sum: { amount: 10000 },
    });

    const result = await service.getImpactMetrics('company-1');

    expect(result.co2Offset).toBe(10000);
    expect(result.treesPlanted).toBe(Math.round((10000 * 1000) / 22));
    expect(result.carsRemoved).toBeGreaterThan(2000);
    expect(result.homesPowered).toBeGreaterThan(1000);
  });
});
