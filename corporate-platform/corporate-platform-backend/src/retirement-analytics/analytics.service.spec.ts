import { Test, TestingModule } from '@nestjs/testing';
import { RetirementAnalyticsService } from './analytics.service';
import { PrismaService } from '../shared/database/prisma.service';
import { PurposeBreakdownService } from './services/purpose-breakdown.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { ForecastingService } from './services/forecasting.service';
import { ImpactMetricsService } from './services/impact-metrics.service';

describe('RetirementAnalyticsService', () => {
  let service: RetirementAnalyticsService;

  const mockPrismaService = {
    company: { findUnique: jest.fn() },
    retirement: { aggregate: jest.fn() },
  };

  const mockPurposeBreakdown = { getBreakdown: jest.fn() };
  const mockTrendAnalysis = { getTrends: jest.fn() };
  const mockForecasting = { getForecast: jest.fn() };
  const mockImpactMetrics = { getImpactMetrics: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetirementAnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PurposeBreakdownService, useValue: mockPurposeBreakdown },
        { provide: TrendAnalysisService, useValue: mockTrendAnalysis },
        { provide: ForecastingService, useValue: mockForecasting },
        { provide: ImpactMetricsService, useValue: mockImpactMetrics },
      ],
    }).compile();

    service = module.get<RetirementAnalyticsService>(
      RetirementAnalyticsService,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate purpose breakdown to sub-service', async () => {
    const expected = {
      purposes: [],
      totalRetired: 0,
      periodStart: '',
      periodEnd: '',
    };
    mockPurposeBreakdown.getBreakdown.mockResolvedValue(expected);

    const result = await service.getPurposeBreakdown({ companyId: 'c1' });

    expect(result).toEqual(expected);
    expect(mockPurposeBreakdown.getBreakdown).toHaveBeenCalledWith(
      'c1',
      undefined,
      undefined,
    );
  });

  it('should delegate trends to sub-service', async () => {
    const expected = {
      periods: [],
      aggregation: 'monthly',
      totalRetired: 0,
      totalTarget: 0,
    };
    mockTrendAnalysis.getTrends.mockResolvedValue(expected);

    const result = await service.getTrends({ companyId: 'c1' });

    expect(result).toEqual(expected);
    expect(mockTrendAnalysis.getTrends).toHaveBeenCalled();
  });

  it('should delegate forecast to sub-service', async () => {
    const expected = { projections: [], methodology: 'test', basedOnMonths: 0 };
    mockForecasting.getForecast.mockResolvedValue(expected);

    const result = await service.getForecast({ companyId: 'c1' });

    expect(result).toEqual(expected);
    expect(mockForecasting.getForecast).toHaveBeenCalledWith('c1');
  });

  it('should delegate impact metrics to sub-service', async () => {
    const expected = {
      co2Offset: 0,
      treesPlanted: 0,
      carsRemoved: 0,
      homesPowered: 0,
      calculationStandard: 'GHG Protocol Corporate Standard',
    };
    mockImpactMetrics.getImpactMetrics.mockResolvedValue(expected);

    const result = await service.getImpactMetrics({ companyId: 'c1' });

    expect(result).toEqual(expected);
    expect(mockImpactMetrics.getImpactMetrics).toHaveBeenCalled();
  });

  it('should return progress with default values when company not found', async () => {
    mockPrismaService.company.findUnique.mockResolvedValue(null);

    const result = await service.getProgress({ companyId: 'nonexistent' });

    expect(result.annual.target).toBe(0);
    expect(result.annual.achieved).toBe(0);
    expect(result.netZero.target).toBe(0);
    expect(result.onTrack).toBe(false);
    expect(result.behindScheduleAlert).toBe(false);
  });

  it('should calculate progress correctly when company exists', async () => {
    mockPrismaService.company.findUnique.mockResolvedValue({
      id: 'c1',
      annualRetirementTarget: 1000,
      netZeroTarget: 10000,
    });

    mockPrismaService.retirement.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 500 } }) // annual
      .mockResolvedValueOnce({ _sum: { amount: 2000 } }); // lifetime

    const result = await service.getProgress({ companyId: 'c1' });

    expect(result.annual.target).toBe(1000);
    expect(result.annual.achieved).toBe(500);
    expect(result.annual.percentage).toBe(50);
    expect(result.netZero.target).toBe(10000);
    expect(result.netZero.achieved).toBe(2000);
    expect(result.netZero.percentage).toBe(20);
    expect(result.behindScheduleAlert).toBeDefined();
  });

  it('should return combined summary', async () => {
    mockPurposeBreakdown.getBreakdown.mockResolvedValue({ purposes: [] });
    mockTrendAnalysis.getTrends.mockResolvedValue({ periods: [] });
    mockForecasting.getForecast.mockResolvedValue({ projections: [] });
    mockImpactMetrics.getImpactMetrics.mockResolvedValue({ co2Offset: 0 });
    mockPrismaService.company.findUnique.mockResolvedValue(null);

    const result = await service.getSummary({ companyId: 'c1' });

    expect(result).toHaveProperty('purposeBreakdown');
    expect(result).toHaveProperty('trends');
    expect(result).toHaveProperty('forecast');
    expect(result).toHaveProperty('impact');
    expect(result).toHaveProperty('progress');
  });
});
