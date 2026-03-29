import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { CollaborationScoreService } from './collaboration-score.service';

describe('CollaborationScoreService', () => {
  let service: CollaborationScoreService;
  let prisma: {
    teamActivity: { groupBy: jest.Mock };
    memberEngagement: { upsert: jest.Mock; findMany: jest.Mock };
    collaborationMetric: { create: jest.Mock; findMany: jest.Mock };
    company: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    prisma = {
      teamActivity: { groupBy: jest.fn() },
      memberEngagement: { upsert: jest.fn(), findMany: jest.fn() },
      collaborationMetric: { create: jest.fn(), findMany: jest.fn() },
      company: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    cache = { get: jest.fn(), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationScoreService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(CollaborationScoreService);
  });

  it('computes an explainable 0-100 collaboration score with components', async () => {
    prisma.teamActivity.groupBy.mockImplementation((args: any) => {
      if (Array.isArray(args.by) && args.by.includes('activityType')) {
        return [
          { userId: 'u1', activityType: 'COMMENT_CREATED', _count: { _all: 4 } },
          { userId: 'u1', activityType: 'LOGIN', _count: { _all: 6 } },
          { userId: 'u2', activityType: 'REPORT_GENERATED', _count: { _all: 2 } },
          { userId: 'u2', activityType: 'LOGIN', _count: { _all: 3 } },
        ];
      }
      return [
        { userId: 'u1', _count: { _all: 10 } },
        { userId: 'u2', _count: { _all: 5 } },
      ];
    });

    prisma.$queryRaw.mockResolvedValue([
      { userId: 'u1', uniqueDays: 3 },
      { userId: 'u2', uniqueDays: 2 },
    ]);

    const periodStart = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = new Date('2026-01-08T00:00:00.000Z');

    const result = await service.computeTeamScore('c1', periodStart, periodEnd);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.components).toEqual(
      expect.objectContaining({
        activityConsistency: expect.any(Number),
        contributionVolume: expect.any(Number),
        knowledgeSharing: expect.any(Number),
        responsiveness: expect.any(Number),
        crossInteraction: expect.any(Number),
      }),
    );
    expect(result.explanation.weights).toEqual(
      expect.objectContaining({
        activityConsistency: expect.any(Number),
        contributionVolume: expect.any(Number),
      }),
    );

    expect(result.overallScore).toBeCloseTo(34.29, 1);
  });
});

