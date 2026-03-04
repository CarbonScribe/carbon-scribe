import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';
import { ApiKeyGuard } from '../src/api-key/guards/api-key.guard';
import { ApiKeyStrategy } from '../src/api-key/strategies/api-key.strategy';
import { ApiKeyService } from '../src/api-key/api-key.service';
import { PrismaService } from '../src/shared/database/prisma.service';
import { RetirementAnalyticsService } from '../src/retirement-analytics/analytics.service';
import { ApiKeyRetirementAnalyticsController } from '../src/retirement-analytics/api-key-analytics.controller';

describe('API key integration (e2e)', () => {
  let app: INestApplication;

  const httpClient = () => request(app.getHttpAdapter().getInstance());

  const mockPrismaService = {
    apiKey: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockRetirementAnalyticsService = {
    getSummary: jest.fn(),
    getPurposeBreakdown: jest.fn(),
    getTrends: jest.fn(),
    getForecast: jest.fn(),
    getImpactMetrics: jest.fn(),
    getProgress: jest.fn(),
  };

  const baseRecord = () => ({
    id: 'api-key-1',
    name: 'Integration Key',
    key: 'hashed-value',
    prefix: 'sk_live_abc1',
    companyId: 'company-123',
    createdBy: 'user-1',
    permissions: ['analytics:read'],
    lastUsedAt: null,
    requestCount: 0,
    expiresAt: null,
    rateLimit: 100,
    ipWhitelist: [],
    isActive: true,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.apiKey.update.mockResolvedValue({});
    mockPrismaService.apiKey.findFirst.mockResolvedValue(baseRecord());
    mockRetirementAnalyticsService.getSummary.mockImplementation((query) =>
      Promise.resolve({ ok: true, companyId: query.companyId, query }),
    );
    mockRetirementAnalyticsService.getPurposeBreakdown.mockResolvedValue({
      purposes: [],
      totalRetired: 0,
      periodStart: '',
      periodEnd: '',
    });
    mockRetirementAnalyticsService.getTrends.mockResolvedValue({
      periods: [],
      aggregation: 'monthly',
      totalRetired: 0,
      totalTarget: 0,
    });
    mockRetirementAnalyticsService.getForecast.mockResolvedValue({
      projections: [],
      methodology: 'test',
      basedOnMonths: 0,
    });
    mockRetirementAnalyticsService.getImpactMetrics.mockResolvedValue({
      co2Offset: 0,
      treesPlanted: 0,
      carsRemoved: 0,
      homesPowered: 0,
      calculationStandard: 'GHG Protocol Corporate Standard',
    });
    mockRetirementAnalyticsService.getProgress.mockResolvedValue({
      annual: { target: 0, achieved: 0, percentage: 0 },
      netZero: { target: 0, achieved: 0, percentage: 0 },
      onTrack: true,
      behindScheduleAlert: false,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyRetirementAnalyticsController],
      providers: [
        Reflector,
        ApiKeyGuard,
        ApiKeyStrategy,
        ApiKeyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RetirementAnalyticsService,
          useValue: mockRetirementAnalyticsService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('authenticates requests and enforces company isolation on protected analytics endpoints', async () => {
    const response = await httpClient()
      .get('/api/v1/integrations/retirement-analytics/summary')
      .query({ companyId: 'other-company', startDate: '2026-01-01' })
      .set('x-api-key', 'sk_live_real_secret')
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();

    expect(response.body.ok).toBe(true);
    expect(response.body.companyId).toBe('company-123');
    expect(mockRetirementAnalyticsService.getSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-123',
        startDate: '2026-01-01',
      }),
    );
    expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'api-key-1' },
        data: expect.objectContaining({
          requestCount: { increment: 1 },
        }),
      }),
    );
  });

  it('rejects invalid keys on protected endpoints', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

    await httpClient()
      .get('/api/v1/integrations/retirement-analytics/summary')
      .set('x-api-key', 'sk_live_invalid')
      .expect(401);
  });

  it('rejects revoked keys', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      ...baseRecord(),
      isActive: false,
      revokedAt: new Date(),
      revokedReason: 'Revoked',
    });

    await httpClient()
      .get('/api/v1/integrations/retirement-analytics/summary')
      .set('x-api-key', 'sk_live_revoked')
      .expect(401);
  });

  it('blocks unauthorized IPs when whitelist is configured', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      ...baseRecord(),
      ipWhitelist: ['203.0.113.10'],
    });

    await httpClient()
      .get('/api/v1/integrations/retirement-analytics/summary')
      .set('x-api-key', 'sk_live_whitelist')
      .set('x-forwarded-for', '198.51.100.24')
      .expect(401);
  });

  it('enforces per-key rate limiting and returns 429 headers', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      ...baseRecord(),
      rateLimit: 1,
    });

    await httpClient()
      .get('/api/v1/integrations/retirement-analytics/summary')
      .set('x-api-key', 'sk_live_rate_limited')
      .expect(200);

    const response = await httpClient()
      .get('/api/v1/integrations/retirement-analytics/summary')
      .set('x-api-key', 'sk_live_rate_limited')
      .expect(429);

    expect(response.headers['x-ratelimit-limit']).toBe('1');
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });
});
