import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../database/prisma.service';
import { computeRequestHash } from './idempotency.utils';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  const mockPrisma = {
    idempotencyRecord: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  const KEY = '550e8400-e29b-41d4-a716-446655440000';
  const COMPANY_ID = 'company-123';
  const ROUTE = '/api/v1/cart/checkout';
  const PAYLOAD = { paymentMethod: 'credit_card' };
  const HASH = computeRequestHash(PAYLOAD);

  describe('acquire', () => {
    it('creates a new pending record on first request and returns isReplay: false', async () => {
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue(null);
      mockPrisma.idempotencyRecord.create.mockResolvedValue({
        id: 'rec-1',
        key: KEY,
        companyId: COMPANY_ID,
        route: ROUTE,
        requestHash: HASH,
        status: 'pending',
      });

      const result = await service.acquire(KEY, COMPANY_ID, ROUTE, HASH);

      expect(result).toEqual({ isReplay: false });
      expect(mockPrisma.idempotencyRecord.findFirst).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, key: KEY },
      });
      expect(mockPrisma.idempotencyRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: KEY,
          companyId: COMPANY_ID,
          route: ROUTE,
          requestHash: HASH,
          status: 'pending',
        }),
      });
    });

    it('returns cached response on replay with same key and same payload', async () => {
      const cachedResponse = { orderId: 'order-1', status: 'pending' };
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        key: KEY,
        companyId: COMPANY_ID,
        route: ROUTE,
        requestHash: HASH,
        status: 'completed',
        responseStatus: 201,
        responseBody: cachedResponse,
        expiresAt: new Date(Date.now() + 100000),
      });

      const result = await service.acquire(KEY, COMPANY_ID, ROUTE, HASH);

      expect(result).toEqual({
        isReplay: true,
        responseStatus: 201,
        responseBody: cachedResponse,
      });
      expect(mockPrisma.idempotencyRecord.create).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException (422) on replay with different payload', async () => {
      const differentHash = computeRequestHash({ paymentMethod: 'wire' });
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        key: KEY,
        companyId: COMPANY_ID,
        route: ROUTE,
        requestHash: HASH,
        status: 'completed',
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.acquire(KEY, COMPANY_ID, ROUTE, differentHash),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws ConflictException (409) if existing record is still pending', async () => {
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        key: KEY,
        companyId: COMPANY_ID,
        route: ROUTE,
        requestHash: HASH,
        status: 'pending',
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.acquire(KEY, COMPANY_ID, ROUTE, HASH),
      ).rejects.toThrow(ConflictException);
    });

    it('resets expired record to pending and allows execution', async () => {
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        key: KEY,
        companyId: COMPANY_ID,
        route: ROUTE,
        requestHash: HASH,
        status: 'completed',
        expiresAt: new Date(Date.now() - 1000), // Expired!
      });
      mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.acquire(KEY, COMPANY_ID, ROUTE, HASH);

      expect(result).toEqual({ isReplay: false });
      expect(mockPrisma.idempotencyRecord.updateMany).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: 'pending',
          requestHash: HASH,
        }),
      });
    });

    it('allows retry if previous attempt failed', async () => {
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
        id: 'rec-1',
        key: KEY,
        companyId: COMPANY_ID,
        route: ROUTE,
        requestHash: HASH,
        status: 'failed',
        expiresAt: new Date(Date.now() + 100000),
      });
      mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.acquire(KEY, COMPANY_ID, ROUTE, HASH);

      expect(result).toEqual({ isReplay: false });
      expect(mockPrisma.idempotencyRecord.updateMany).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: 'pending',
          requestHash: HASH,
        }),
      });
    });

    it('handles P2002 race condition on concurrent insert and throws ConflictException if pending', async () => {
      mockPrisma.idempotencyRecord.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-concurrent',
          key: KEY,
          companyId: COMPANY_ID,
          route: ROUTE,
          requestHash: HASH,
          status: 'pending',
          expiresAt: new Date(Date.now() + 100000),
        });

      const p2002Error: any = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';
      mockPrisma.idempotencyRecord.create.mockRejectedValue(p2002Error);

      await expect(
        service.acquire(KEY, COMPANY_ID, ROUTE, HASH),
      ).rejects.toThrow(ConflictException);
    });

    it('handles P2002 race condition and returns replay if concurrent request completed', async () => {
      const cached = { orderId: 'order-concurrent' };
      mockPrisma.idempotencyRecord.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-concurrent',
          key: KEY,
          companyId: COMPANY_ID,
          route: ROUTE,
          requestHash: HASH,
          status: 'completed',
          responseStatus: 201,
          responseBody: cached,
          expiresAt: new Date(Date.now() + 100000),
        });

      const p2002Error: any = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';
      mockPrisma.idempotencyRecord.create.mockRejectedValue(p2002Error);

      const result = await service.acquire(KEY, COMPANY_ID, ROUTE, HASH);

      expect(result).toEqual({
        isReplay: true,
        responseStatus: 201,
        responseBody: cached,
      });
    });

    it('scopes records per company: different companies with same key are isolated', async () => {
      mockPrisma.idempotencyRecord.findFirst.mockResolvedValue(null);
      mockPrisma.idempotencyRecord.create.mockResolvedValue({ id: 'rec-2' });

      await service.acquire(KEY, 'company-A', ROUTE, HASH);
      expect(mockPrisma.idempotencyRecord.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'company-A', key: KEY },
      });

      await service.acquire(KEY, 'company-B', ROUTE, HASH);
      expect(mockPrisma.idempotencyRecord.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'company-B', key: KEY },
      });
    });
  });

  describe('complete', () => {
    it('updates record with completed status and response data', async () => {
      mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });
      const responseData = { id: 'order-1', total: 100 };

      await service.complete(KEY, COMPANY_ID, 201, responseData);

      expect(mockPrisma.idempotencyRecord.updateMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, key: KEY },
        data: {
          status: 'completed',
          responseStatus: 201,
          responseBody: responseData,
        },
      });
    });
  });

  describe('fail', () => {
    it('marks pending record as failed', async () => {
      mockPrisma.idempotencyRecord.updateMany.mockResolvedValue({ count: 1 });

      await service.fail(KEY, COMPANY_ID);

      expect(mockPrisma.idempotencyRecord.updateMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, key: KEY, status: 'pending' },
        data: { status: 'failed' },
      });
    });
  });

  describe('cleanupExpired', () => {
    it('deletes records where expiresAt < now', async () => {
      mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 5 });

      const deleted = await service.cleanupExpired();

      expect(deleted).toBe(5);
      expect(mockPrisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
