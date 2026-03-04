import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ApiKeyRetirementAnalyticsController } from './api-key-analytics.controller';
import { RetirementAnalyticsService } from './analytics.service';
import { ApiKeyGuard } from '../api-key/guards/api-key.guard';
import { ApiKeyStrategy } from '../api-key/strategies/api-key.strategy';
import { ApiKeyService } from '../api-key/api-key.service';
import { PrismaService } from '../shared/database/prisma.service';

describe('ApiKeyRetirementAnalyticsController', () => {
  let controller: ApiKeyRetirementAnalyticsController;

  const mockAnalyticsService = {
    getPurposeBreakdown: jest.fn(),
    getTrends: jest.fn(),
    getForecast: jest.fn(),
    getImpactMetrics: jest.fn(),
    getProgress: jest.fn(),
    getSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyRetirementAnalyticsController],
      providers: [
        {
          provide: ApiKeyGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        Reflector,
        ApiKeyStrategy,
        ApiKeyService,
        {
          provide: PrismaService,
          useValue: {
            apiKey: {
              findFirst: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: RetirementAnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<ApiKeyRetirementAnalyticsController>(
      ApiKeyRetirementAnalyticsController,
    );
    jest.clearAllMocks();
  });

  it('forces companyId from the API key context', async () => {
    mockAnalyticsService.getSummary.mockResolvedValue({ ok: true });

    const query = {
      companyId: 'user-supplied-company',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };
    const apiKey = {
      id: 'k1',
      name: 'Key',
      prefix: 'sk_live_abcd',
      companyId: 'company-123',
      createdBy: 'u1',
      permissions: ['analytics:read'],
      rateLimit: 100,
      ipWhitelist: [],
    };

    await controller.getSummary(query, apiKey as any);

    expect(mockAnalyticsService.getSummary).toHaveBeenCalledWith({
      ...query,
      companyId: 'company-123',
    });
  });
});
