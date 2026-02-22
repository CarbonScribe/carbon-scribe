import { Test, TestingModule } from '@nestjs/testing';
import { ForecastingService } from './forecasting.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('ForecastingService', () => {
  let service: ForecastingService;

  const mockPrismaService = {
    retirement: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ForecastingService>(ForecastingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should produce projections for the requested number of months', async () => {
    const now = new Date();
    const retirements = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear() - 1, now.getMonth() + i, 15);
      retirements.push({ retiredAt: d, amount: 100 + i * 10 });
    }

    mockPrismaService.retirement.findMany.mockResolvedValue(retirements);

    const result = await service.getForecast('company-1', 6);

    expect(result.projections).toHaveLength(6);
    expect(result.basedOnMonths).toBeGreaterThan(0);
    expect(result.methodology).toContain('Linear regression');
  });

  it('should produce non-negative predictions', async () => {
    const now = new Date();
    const retirements = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear() - 1, now.getMonth() + i, 10);
      retirements.push({ retiredAt: d, amount: 50 });
    }

    mockPrismaService.retirement.findMany.mockResolvedValue(retirements);

    const result = await service.getForecast('company-1', 3);

    for (const proj of result.projections) {
      expect(proj.predicted).toBeGreaterThanOrEqual(0);
      expect(proj.confidence.lower).toBeGreaterThanOrEqual(0);
      expect(proj.confidence.upper).toBeGreaterThanOrEqual(proj.predicted);
    }
  });

  it('should handle empty historical data', async () => {
    mockPrismaService.retirement.findMany.mockResolvedValue([]);

    const result = await service.getForecast('company-1', 6);

    expect(result.projections).toHaveLength(6);
    for (const proj of result.projections) {
      expect(proj.predicted).toBe(0);
    }
  });

  it('should include confidence intervals', async () => {
    const now = new Date();
    const retirements = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear() - 1, now.getMonth() + i, 15);
      retirements.push({ retiredAt: d, amount: 100 + i * 20 });
    }

    mockPrismaService.retirement.findMany.mockResolvedValue(retirements);

    const result = await service.getForecast('company-1', 3);

    for (const proj of result.projections) {
      expect(proj.confidence).toBeDefined();
      expect(proj.confidence.lower).toBeLessThanOrEqual(proj.predicted);
      expect(proj.confidence.upper).toBeGreaterThanOrEqual(proj.predicted);
    }
  });

  it('should include R-squared in methodology description', async () => {
    const now = new Date();
    const retirements = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear() - 1, now.getMonth() + i, 10);
      retirements.push({ retiredAt: d, amount: 100 });
    }

    mockPrismaService.retirement.findMany.mockResolvedValue(retirements);

    const result = await service.getForecast('company-1', 3);

    expect(result.methodology).toContain('R²');
  });
});
