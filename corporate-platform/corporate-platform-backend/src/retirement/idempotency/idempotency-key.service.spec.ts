import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { IdempotencyKeyService } from './idempotency-key.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { ContractCallStatus } from '../../stellar/soroban/interfaces/idempotency.interface';

const mockPrisma = {
  contractCall: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
};

// A minimal stand-in for the ioredis client returned by getClient(). Only
// set/del/exists are exercised by IdempotencyKeyService.
const mockRedisClient = {
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
};

const mockRedisService = {
  isHealthy: jest.fn(),
  getClient: jest.fn(() => mockRedisClient),
};

describe('IdempotencyKeyService (#650 — Redis-unavailable fallback)', () => {
  let service: IdempotencyKeyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedisService.getClient.mockReturnValue(mockRedisClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyKeyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get(IdempotencyKeyService);
  });

  const KEY = 'test-idempotency-key-1';
  const COMPANY_ID = 'company-1';
  const USER_ID = 'user-1';

  describe('when Redis is unreachable', () => {
    beforeEach(() => {
      mockRedisService.isHealthy.mockReturnValue(false);
      mockPrisma.contractCall.findFirst.mockResolvedValue(null);
    });

    it('fails fast with a 503 instead of hanging or recursing, and never attempts a lock command', async () => {
      const processor = jest.fn();

      await expect(
        service.processIdempotencyKey(KEY, COMPANY_ID, USER_ID, processor),
      ).rejects.toThrow(ServiceUnavailableException);

      // Fails closed before ever reaching Redis — not a command that then
      // fails, and critically, the business processor (which would submit
      // the actual retirement) is never invoked.
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(processor).not.toHaveBeenCalled();
    });

    it('resolves well within a bounded time (no infinite recursion/hang)', async () => {
      const start = Date.now();

      await expect(
        service.processIdempotencyKey(KEY, COMPANY_ID, USER_ID, jest.fn()),
      ).rejects.toThrow(ServiceUnavailableException);

      // The old bug was unbounded recursion that could run for the entire
      // life of the request; failing closed on the isHealthy() check
      // should return near-instantly.
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('still serves an already-CONFIRMED replay without touching Redis at all', async () => {
      const existingCall = {
        id: 'call-1',
        status: ContractCallStatus.CONFIRMED,
        result: { transactionHash: 'tx-1' },
        transactionHash: 'tx-1',
        workflowId: 'workflow-1',
      };
      mockPrisma.contractCall.findFirst.mockResolvedValue(existingCall);

      const result = await service.processIdempotencyKey(
        KEY,
        COMPANY_ID,
        USER_ID,
        jest.fn(),
      );

      expect(result.isReplay).toBe(true);
      expect(result.status).toBe(ContractCallStatus.CONFIRMED);
      expect(mockRedisService.getClient).not.toHaveBeenCalled();
    });
  });

  describe('when a Redis command fails even though isHealthy() reported true', () => {
    it('acquireLock treats a command failure as unavailable, not as "lock busy" — throws rather than returning false', async () => {
      mockRedisService.isHealthy.mockReturnValue(true);
      mockPrisma.contractCall.findFirst.mockResolvedValue(null);
      mockRedisClient.set.mockRejectedValue(new Error('connection reset'));

      await expect(
        service.processIdempotencyKey(KEY, COMPANY_ID, USER_ID, jest.fn()),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('when the lock is genuinely held by another in-flight request', () => {
    beforeEach(() => {
      mockRedisService.isHealthy.mockReturnValue(true);
      mockPrisma.contractCall.findFirst.mockResolvedValue(null);
      // NX SET never succeeds — lock perpetually held.
      mockRedisClient.set.mockResolvedValue(null);
      // EXISTS always finds the lock still there, so waitForLock's own
      // 5s internal timeout would otherwise be hit on every attempt.
      mockRedisClient.exists.mockResolvedValue(1);
    });

    it('gives up after MAX_LOCK_WAIT_ATTEMPTS instead of recursing forever, and still reports a 503', async () => {
      // Speed the test up: waitForLock polls every 100ms for up to 5s per
      // attempt, and 3 attempts of that would make this test slow. Patch
      // the service's own sleep via a short fake timer instead of
      // changing production polling intervals.
      jest.useFakeTimers();

      const resultPromise = service.processIdempotencyKey(
        KEY,
        COMPANY_ID,
        USER_ID,
        jest.fn(),
      );
      const assertion = expect(resultPromise).rejects.toThrow(
        ServiceUnavailableException,
      );

      // Advance past every waitForLock poll across all bounded attempts.
      await jest.advanceTimersByTimeAsync(3 * 5000 + 1000);

      await assertion;
      jest.useRealTimers();

      // set (acquireLock) is attempted once per lockWaitAttempt: the
      // initial attempt plus MAX_LOCK_WAIT_ATTEMPTS retries.
      expect(mockRedisClient.set.mock.calls.length).toBeGreaterThan(1);
      expect(mockRedisClient.set.mock.calls.length).toBeLessThanOrEqual(4);
    });
  });

  describe('happy path (regression guard — unchanged behavior when Redis is healthy)', () => {
    it('acquires the lock, runs the processor once, records success, and releases the lock', async () => {
      mockRedisService.isHealthy.mockReturnValue(true);
      mockPrisma.contractCall.findFirst.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
      mockPrisma.contractCall.create.mockResolvedValue({
        id: 'call-1',
        transactionHash: 'tx-1',
        workflowId: 'workflow-1',
      });

      const processor = jest
        .fn()
        .mockResolvedValue({ transactionHash: 'tx-1' });

      const result = await service.processIdempotencyKey(
        KEY,
        COMPANY_ID,
        USER_ID,
        processor,
      );

      expect(processor).toHaveBeenCalledTimes(1);
      expect(result.isReplay).toBe(false);
      expect(result.status).toBe(ContractCallStatus.CONFIRMED);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `idempotency:lock:${KEY}`,
        'locked',
        'PX',
        30000,
        'NX',
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `idempotency:lock:${KEY}`,
      );
    });
  });
});
