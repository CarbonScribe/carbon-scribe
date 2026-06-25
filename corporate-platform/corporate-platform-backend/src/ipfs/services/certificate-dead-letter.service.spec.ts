import { NotFoundException } from '@nestjs/common';
import { CertificateDeadLetterService } from './certificate-dead-letter.service';
import { CertificateFailureStatus } from '../interfaces/certificate-failure.interface';

describe('CertificateDeadLetterService', () => {
  const mockPrisma = {
    certificateAnchorFailure: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  } as any;

  let service: CertificateDeadLetterService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CERT_ANCHOR_RETRY_MAX_ATTEMPTS = '3';
    service = new CertificateDeadLetterService(mockPrisma);
  });

  describe('recordFailure', () => {
    it('creates a new pending record on first failure', async () => {
      mockPrisma.certificateAnchorFailure.findFirst.mockResolvedValue(null);
      mockPrisma.certificateAnchorFailure.create.mockImplementation(
        ({ data }: any) => ({ id: 'f1', ...data }),
      );

      const record = await service.recordFailure({
        retirementId: 'ret-1',
        companyId: 'co-1',
        certificateData: { content: 'abc' },
        error: 'pin failed',
      });

      expect(mockPrisma.certificateAnchorFailure.create).toHaveBeenCalledTimes(
        1,
      );
      expect(record.attemptCount).toBe(1);
      expect(record.status).toBe(CertificateFailureStatus.PENDING);
      expect(record.lastError).toBe('pin failed');
      expect(record.nextRetryAt).toBeInstanceOf(Date);
    });

    it('updates the existing unresolved record for the same retirement', async () => {
      mockPrisma.certificateAnchorFailure.findFirst.mockResolvedValue({
        id: 'f1',
        attemptCount: 1,
        companyId: 'co-1',
        status: CertificateFailureStatus.PENDING,
      });
      mockPrisma.certificateAnchorFailure.update.mockImplementation(
        ({ data }: any) => ({ id: 'f1', ...data }),
      );

      const record = await service.recordFailure({
        retirementId: 'ret-1',
        certificateData: { content: 'abc' },
        error: 'pin failed again',
      });

      expect(mockPrisma.certificateAnchorFailure.create).not.toHaveBeenCalled();
      expect(mockPrisma.certificateAnchorFailure.update).toHaveBeenCalledTimes(
        1,
      );
      expect(record.attemptCount).toBe(2);
    });

    it('marks the record FAILED once the attempt budget is exhausted', async () => {
      mockPrisma.certificateAnchorFailure.findFirst.mockResolvedValue({
        id: 'f1',
        attemptCount: 2, // next attempt -> 3 == maxAttempts
        status: CertificateFailureStatus.PENDING,
      });
      mockPrisma.certificateAnchorFailure.update.mockImplementation(
        ({ data }: any) => ({ id: 'f1', ...data }),
      );

      const record = await service.recordFailure({
        retirementId: 'ret-1',
        certificateData: {},
        error: 'still failing',
      });

      expect(record.attemptCount).toBe(3);
      expect(record.status).toBe(CertificateFailureStatus.FAILED);
    });
  });

  describe('getFailure', () => {
    it('throws NotFoundException when the record is missing', async () => {
      mockPrisma.certificateAnchorFailure.findUnique.mockResolvedValue(null);
      await expect(service.getFailure('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('claimForProcessing', () => {
    it('returns the record when the claim updates a row', async () => {
      mockPrisma.certificateAnchorFailure.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.certificateAnchorFailure.findUnique.mockResolvedValue({
        id: 'f1',
        status: CertificateFailureStatus.IN_PROGRESS,
      });

      const claimed = await service.claimForProcessing('f1');
      expect(claimed).not.toBeNull();
    });

    it('returns null when nothing was claimed (already in progress)', async () => {
      mockPrisma.certificateAnchorFailure.updateMany.mockResolvedValue({
        count: 0,
      });
      const claimed = await service.claimForProcessing('f1');
      expect(claimed).toBeNull();
      expect(
        mockPrisma.certificateAnchorFailure.findUnique,
      ).not.toHaveBeenCalled();
    });
  });

  describe('markRetryFailed', () => {
    it('reschedules while budget remains', async () => {
      mockPrisma.certificateAnchorFailure.findUnique.mockResolvedValue({
        id: 'f1',
        attemptCount: 1,
      });
      mockPrisma.certificateAnchorFailure.update.mockImplementation(
        ({ data }: any) => ({ id: 'f1', ...data }),
      );

      const record = await service.markRetryFailed('f1', 'boom');
      expect(record.attemptCount).toBe(2);
      expect(record.status).toBe(CertificateFailureStatus.PENDING);
      expect(record.nextRetryAt).toBeInstanceOf(Date);
    });

    it('gives up (FAILED, no next retry) when budget is exhausted', async () => {
      mockPrisma.certificateAnchorFailure.findUnique.mockResolvedValue({
        id: 'f1',
        attemptCount: 2, // -> 3 == maxAttempts
      });
      mockPrisma.certificateAnchorFailure.update.mockImplementation(
        ({ data }: any) => ({ id: 'f1', ...data }),
      );

      const record = await service.markRetryFailed('f1', 'boom');
      expect(record.status).toBe(CertificateFailureStatus.FAILED);
      expect(record.nextRetryAt).toBeNull();
    });
  });

  describe('markResolved', () => {
    it('sets resolved status, cid and timestamp', async () => {
      mockPrisma.certificateAnchorFailure.update.mockImplementation(
        ({ data }: any) => ({ id: 'f1', ...data }),
      );
      const record = await service.markResolved('f1', 'cidXYZ');
      expect(record.status).toBe(CertificateFailureStatus.RESOLVED);
      expect(record.resolvedCid).toBe('cidXYZ');
      expect(record.resolvedAt).toBeInstanceOf(Date);
      expect(record.nextRetryAt).toBeNull();
    });
  });

  describe('listFailures', () => {
    it('clamps pagination and returns totals', async () => {
      mockPrisma.certificateAnchorFailure.findMany.mockResolvedValue([
        { id: 'f1' },
      ]);
      mockPrisma.certificateAnchorFailure.count.mockResolvedValue(1);

      const result = await service.listFailures({ limit: 9999, offset: -5 });
      expect(result.limit).toBe(200); // clamped to max
      expect(result.offset).toBe(0); // clamped to min
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });
});
