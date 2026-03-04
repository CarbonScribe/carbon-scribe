import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { ApiKeyService } from './api-key.service';
import { PrismaService } from '../shared/database/prisma.service';
import { ApiKeyPermissions } from './decorators/api-key-permissions.decorator';

class TestProtectedController {
  @ApiKeyPermissions('analytics:read')
  protectedHandler() {}
}

type TestRequest = {
  headers: Record<string, string | undefined>;
  socket: { remoteAddress?: string };
  apiKey?: unknown;
  user?: unknown;
};

type TestResponse = {
  setHeader: jest.Mock;
};

describe('ApiKeyGuard (integration)', () => {
  let guard: ApiKeyGuard;

  const mockPrismaService = {
    apiKey: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
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
    mockPrismaService.apiKey.findFirst.mockResolvedValue(baseRecord());
    mockPrismaService.apiKey.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Reflector,
        ApiKeyGuard,
        ApiKeyStrategy,
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get(ApiKeyGuard);
  });

  function buildContext(
    requestOverrides: Partial<TestRequest> = {},
    handler: () => void = TestProtectedController.prototype.protectedHandler,
  ) {
    const request: TestRequest = {
      headers: {
        'x-api-key': 'sk_live_secret',
      },
      socket: { remoteAddress: '203.0.113.10' },
      ...requestOverrides,
    };

    const response: TestResponse = {
      setHeader: jest.fn(),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => handler,
      getClass: () => TestProtectedController,
    } as any;

    return { context, request, response };
  }

  it('authenticates a protected endpoint request and sets rate limit headers', async () => {
    const { context, request, response } = buildContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.apiKey).toEqual(
      expect.objectContaining({ companyId: 'company-123' }),
    );
    expect(request.user).toEqual(
      expect.objectContaining({ permissions: ['analytics:read'] }),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Limit',
      expect.any(String),
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

  it('rejects invalid keys', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue(null);
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects revoked keys', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      ...baseRecord(),
      isActive: false,
      revokedAt: new Date(),
    });
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('blocks IPs that are not whitelisted', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      ...baseRecord(),
      ipWhitelist: ['198.51.100.10'],
    });
    const { context } = buildContext({
      headers: {
        'x-api-key': 'sk_live_secret',
        'x-forwarded-for': '203.0.113.10',
      },
      socket: { remoteAddress: '203.0.113.10' },
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('enforces rate limiting and surfaces 429 headers', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      ...baseRecord(),
      rateLimit: 1,
    });

    const first = buildContext({
      headers: { 'x-api-key': 'sk_live_rate_limit' },
    });
    await expect(guard.canActivate(first.context)).resolves.toBe(true);

    const second = buildContext({
      headers: { 'x-api-key': 'sk_live_rate_limit' },
    });
    await expect(guard.canActivate(second.context)).rejects.toBeInstanceOf(
      HttpException,
    );

    try {
      await guard.canActivate(second.context);
      throw new Error('Expected rate limit exception');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(second.response.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '1',
      );
      expect(second.response.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '0',
      );
      expect(second.response.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String),
      );
    }
  });
});
