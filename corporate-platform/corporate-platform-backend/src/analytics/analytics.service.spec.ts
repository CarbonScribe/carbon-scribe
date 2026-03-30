import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../shared/database/prisma.service';
import { CacheService } from '../cache/cache.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaService;
  let cache: CacheService;

  beforeEach(async () => {
    const mockPrisma = {
      analyticsCache: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePercentageChange', () => {
    it('should calculate percentage change correctly', () => {
      const result = service.calculatePercentageChange(150, 100);
      expect(result).toBe(50);
    });

    it('should return 0 when previous value is 0', () => {
      const result = service.calculatePercentageChange(100, 0);
      expect(result).toBe(0);
    });

    it('should handle negative changes', () => {
      const result = service.calculatePercentageChange(50, 100);
      expect(result).toBe(-50);
    });
  });

  describe('calculateRollingAverage', () => {
    it('should calculate rolling average correctly', () => {
      const data = [1, 2, 3, 4, 5];
      const result = service.calculateRollingAverage(data, 3);
      expect(result).toEqual([1, 1.5, 2, 3, 4]);
    });

    it('should handle empty data', () => {
      const result = service.calculateRollingAverage([], 3);
      expect(result).toEqual([]);
    });

    it('should handle window size larger than data', () => {
      const data = [1, 2];
      const result = service.calculateRollingAverage(data, 5);
      expect(result).toEqual([1, 1.5]);
    });
  });

  describe('calculatePercentileRank', () => {
    it('should calculate percentile rank correctly', () => {
      const values = [10, 20, 30, 40, 50];
      const result = service.calculatePercentileRank(30, values);
      expect(result).toBe(60); // 30 is at 60th percentile
    });

    it('should rank lowest value at 0 percentile', () => {
      const values = [10, 20, 30, 40, 50];
      const result = service.calculatePercentileRank(10, values);
      expect(result).toBe(0);
    });

    it('should rank highest value at 100 percentile', () => {
      const values = [10, 20, 30, 40, 50];
      const result = service.calculatePercentileRank(50, values);
      expect(result).toBeCloseTo(100, 0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect statistical anomalies', () => {
      const data = [10, 12, 11, 13, 12, 100, 11, 12]; // 100 is anomaly
      const anomalies = service.detectAnomalies(data, 2);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies).toContain(5); // Index of 100
    });

    it('should return empty array for normal data', () => {
      const data = [10, 11, 12, 11, 10, 11, 12];
      const anomalies = service.detectAnomalies(data, 3);
      expect(anomalies.length).toBe(0);
    });

    it('should handle data with less than 2 points', () => {
      const anomalies = service.detectAnomalies([10], 2);
      expect(anomalies).toEqual([]);
    });
  });

  describe('ensureMultiTenantAccess', () => {
    it('should allow access when company ID matches', () => {
      const result = service.ensureMultiTenantAccess('company1', 'company1');
      expect(result).toBe(true);
    });

    it('should deny access when company ID does not match', () => {
      const result = service.ensureMultiTenantAccess('company1', 'company2');
      expect(result).toBe(false);
    });

    it('should allow access for global data (null companyId)', () => {
      const result = service.ensureMultiTenantAccess('company1', null);
      expect(result).toBe(true);
    });
  });

  describe('getDateRange', () => {
    it('should calculate date range correctly', () => {
      const result = service.getDateRange('2024-01-01', '2024-01-31');
      expect(result.startDate).toEqual(new Date('2024-01-01'));
      expect(result.endDate).toEqual(new Date('2024-01-31'));
      expect(result.days).toBe(30);
    });

    it('should handle same date range', () => {
      const result = service.getDateRange('2024-01-01', '2024-01-01');
      expect(result.days).toBe(0);
    });
  });

  describe('formatChartData', () => {
    it('should format data for chart visualization', () => {
      const data = [1, 2, 3];
      const labels = ['A', 'B', 'C'];
      const datasets = [{ label: 'Dataset 1', data: [1, 2, 3] }];

      const result = service.formatChartData(data, labels, datasets);

      expect(result.labels).toEqual(labels);
      expect(result.datasets).toEqual(datasets);
      expect(result.meta.dataPoints).toBe(3);
      expect(result.meta.generatedAt).toBeDefined();
    });
  });

  describe('cacheMetrics', () => {
    it('should cache metrics in both Redis and database', async () => {
      const mockData = { value: 100 };
      const date = new Date();

      await service.cacheMetrics(
        'DASHBOARD',
        'MONTHLY',
        date,
        mockData,
        'company1',
      );

      expect(cache.set).toHaveBeenCalled();
      expect(prisma.analyticsCache.create).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredCache', () => {
    it('should delete expired cache entries', async () => {
      jest
        .spyOn(prisma.analyticsCache, 'deleteMany')
        .mockResolvedValue({ count: 5 });

      await service.cleanupExpiredCache();

      expect(prisma.analyticsCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
