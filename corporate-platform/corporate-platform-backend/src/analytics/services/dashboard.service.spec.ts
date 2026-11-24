import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { AnalyticsService } from '../analytics.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let cache: jest.Mocked<Pick<CacheService, 'delByPattern' | 'del'>>;

  beforeEach(async () => {
    cache = {
      delByPattern: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: {} },
        { provide: CacheService, useValue: cache },
        { provide: AnalyticsService, useValue: {} },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('invalidateCache (#742)', () => {
    it('deletes the overview cache across every cached period and the insights cache', async () => {
      await service.invalidateCache('company-1');

      expect(cache.delByPattern).toHaveBeenCalledWith(
        'dashboard:overview:company-1:*',
      );
      expect(cache.del).toHaveBeenCalledWith('dashboard:insights:company-1');
    });

    it('scopes invalidation to the given company only', async () => {
      await service.invalidateCache('company-2');

      expect(cache.delByPattern).not.toHaveBeenCalledWith(
        expect.stringContaining('company-1'),
      );
      expect(cache.del).not.toHaveBeenCalledWith(
        expect.stringContaining('company-1'),
      );
    });
  });
});
