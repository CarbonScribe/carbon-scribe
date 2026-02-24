import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { PrismaService } from '../shared/database/prisma.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  const mockPrismaService = {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const adminUser = {
    sub: 'user-1',
    email: 'admin@example.com',
    companyId: 'company-1',
    role: 'admin',
    sessionId: 'session-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    jest.clearAllMocks();
  });

  it('should create a hashed API key and return the secret once', async () => {
    mockPrismaService.apiKey.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'key-1',
        name: data.name,
        key: data.key,
        prefix: data.prefix,
        companyId: data.companyId,
        createdBy: data.createdBy,
        permissions: data.permissions,
        lastUsedAt: null,
        requestCount: 0,
        expiresAt: data.expiresAt ?? null,
        rateLimit: data.rateLimit,
        ipWhitelist: data.ipWhitelist,
        isActive: true,
        revokedAt: null,
        revokedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await service.create(
      {
        name: 'Production Integration',
        permissions: ['reports:read', 'analytics:read'],
        rateLimit: 120,
        environment: 'live',
      },
      adminUser,
    );

    expect(result.secret).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
    expect(result.secret.length).toBeGreaterThanOrEqual(32);

    const createArg = mockPrismaService.apiKey.create.mock.calls[0][0];
    expect(createArg.data.key).not.toBe(result.secret);
    expect(createArg.data.key).toMatch(/^[a-f0-9]{64}$/);
    expect(createArg.data.prefix).toBe(result.secret.slice(0, 12));
  });

  it('should enforce required permissions during API key authentication', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      name: 'Integration Key',
      key: 'hash',
      prefix: 'sk_live_abcd',
      companyId: 'company-1',
      createdBy: 'user-1',
      permissions: ['reports:read'],
      lastUsedAt: null,
      requestCount: 0,
      expiresAt: null,
      rateLimit: 10,
      ipWhitelist: [],
      isActive: true,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.authenticate('sk_live_test', {}, ['reports:write']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should rate limit API key authentication attempts per minute', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      name: 'Integration Key',
      key: 'hash',
      prefix: 'sk_live_abcd',
      companyId: 'company-1',
      createdBy: 'user-1',
      permissions: ['reports:read'],
      lastUsedAt: null,
      requestCount: 0,
      expiresAt: null,
      rateLimit: 1,
      ipWhitelist: [],
      isActive: true,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrismaService.apiKey.update.mockResolvedValue({});

    const first = await service.authenticate('sk_live_test', {}, []);
    expect(first.rateLimit.limit).toBe(1);
    expect(first.rateLimit.remaining).toBe(0);
    expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-1' },
        data: expect.objectContaining({
          requestCount: { increment: 1 },
        }),
      }),
    );

    try {
      await service.authenticate('sk_live_test', {}, []);
      throw new Error('Expected rate limit exception');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('should reject revoked keys', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      name: 'Revoked Key',
      key: 'hash',
      prefix: 'sk_live_abcd',
      companyId: 'company-1',
      createdBy: 'user-1',
      permissions: [],
      lastUsedAt: null,
      requestCount: 0,
      expiresAt: null,
      rateLimit: 100,
      ipWhitelist: [],
      isActive: false,
      revokedAt: new Date(),
      revokedReason: 'Revoked',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.authenticate('sk_live_test', {}, []),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should reject expired keys', async () => {
    mockPrismaService.apiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      name: 'Expired Key',
      key: 'hash',
      prefix: 'sk_live_abcd',
      companyId: 'company-1',
      createdBy: 'user-1',
      permissions: [],
      lastUsedAt: null,
      requestCount: 0,
      expiresAt: new Date(Date.now() - 60_000),
      rateLimit: 100,
      ipWhitelist: [],
      isActive: true,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.authenticate('sk_live_test', {}, []),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
