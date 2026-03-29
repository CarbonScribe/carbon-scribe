import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { RedisService } from '../../cache/redis.service';
import { ActivityFeedService } from './activity-feed.service';

describe('ActivityFeedService', () => {
  let service: ActivityFeedService;
  let prisma: { teamActivity: { findMany: jest.Mock; create: jest.Mock; deleteMany: jest.Mock; groupBy: jest.Mock; count: jest.Mock } };
  let cache: { get: jest.Mock; set: jest.Mock; evict: jest.Mock };
  let redis: { getClient: jest.Mock; isHealthy: jest.Mock };

  beforeEach(async () => {
    prisma = {
      teamActivity: {
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
    };
    cache = { get: jest.fn(), set: jest.fn(), evict: jest.fn() };
    redis = { getClient: jest.fn(), isHealthy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityFeedService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(ActivityFeedService);
  });

  it('paginates the activity feed with a nextCursor', async () => {
    prisma.teamActivity.findMany.mockResolvedValue([
      { id: 'a1', timestamp: new Date(), metadata: {}, activityType: 'LOGIN', companyId: 'c1', userId: 'u1' },
      { id: 'a2', timestamp: new Date(), metadata: {}, activityType: 'LOGIN', companyId: 'c1', userId: 'u1' },
      { id: 'a3', timestamp: new Date(), metadata: {}, activityType: 'LOGIN', companyId: 'c1', userId: 'u1' },
    ]);

    const result = await service.getActivityFeed('c1', { limit: 2 } as any);

    expect(prisma.teamActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('a2');
  });
});

