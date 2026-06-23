import { CertificateRetrySchedulerService } from './certificate-retry-scheduler.service';
import { CertificateFailureStatus } from '../interfaces/certificate-failure.interface';

describe('CertificateRetrySchedulerService', () => {
  let deadLetter: any;
  let certificateIpfs: any;
  let notifications: any;
  let scheduler: CertificateRetrySchedulerService;

  beforeEach(() => {
    deadLetter = {
      findDueForRetry: jest.fn().mockResolvedValue([]),
      claimForProcessing: jest.fn(),
      markResolved: jest.fn(),
      markRetryFailed: jest.fn(),
    };
    certificateIpfs = {
      performAnchor: jest.fn(),
    };
    notifications = {
      notifyIfThresholdExceeded: jest.fn().mockResolvedValue(false),
    };
    scheduler = new CertificateRetrySchedulerService(
      deadLetter,
      certificateIpfs,
      notifications,
    );
    delete process.env.CERT_ANCHOR_RETRY_ENABLED;
  });

  describe('processOne', () => {
    it('resolves the record on a successful re-anchor', async () => {
      deadLetter.claimForProcessing.mockResolvedValue({
        id: 'f1',
        retirementId: 'ret-1',
        certificateData: { content: 'abc' },
        status: CertificateFailureStatus.IN_PROGRESS,
      });
      certificateIpfs.performAnchor.mockResolvedValue({ cid: 'cid-123' });

      const result = await scheduler.processOne('f1');

      expect(certificateIpfs.performAnchor).toHaveBeenCalledWith('ret-1', {
        content: 'abc',
      });
      expect(deadLetter.markResolved).toHaveBeenCalledWith('f1', 'cid-123');
      expect(result).toEqual({ id: 'f1', resolved: true, cid: 'cid-123' });
    });

    it('marks a retry failure when re-anchoring throws', async () => {
      deadLetter.claimForProcessing.mockResolvedValue({
        id: 'f1',
        retirementId: 'ret-1',
        certificateData: {},
        status: CertificateFailureStatus.IN_PROGRESS,
      });
      certificateIpfs.performAnchor.mockRejectedValue(new Error('still down'));
      deadLetter.markRetryFailed.mockResolvedValue({
        attemptCount: 2,
        status: CertificateFailureStatus.PENDING,
      });

      const result = await scheduler.processOne('f1');

      expect(deadLetter.markRetryFailed).toHaveBeenCalledWith(
        'f1',
        'still down',
      );
      expect(deadLetter.markResolved).not.toHaveBeenCalled();
      expect(result.resolved).toBe(false);
      expect(result.error).toBe('still down');
    });

    it('skips when the record cannot be claimed', async () => {
      deadLetter.claimForProcessing.mockResolvedValue(null);

      const result = await scheduler.processOne('f1');

      expect(certificateIpfs.performAnchor).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'f1',
        resolved: false,
        error: 'not-claimable',
      });
    });
  });

  describe('handleRetries', () => {
    it('processes each due record and checks the alert threshold', async () => {
      deadLetter.findDueForRetry.mockResolvedValue([
        { id: 'f1' },
        { id: 'f2' },
      ]);
      const spy = jest
        .spyOn(scheduler, 'processOne')
        .mockResolvedValue({ id: 'x', resolved: true });

      await scheduler.handleRetries();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(notifications.notifyIfThresholdExceeded).toHaveBeenCalledTimes(1);
    });

    it('does nothing when disabled via env flag', async () => {
      process.env.CERT_ANCHOR_RETRY_ENABLED = 'false';
      await scheduler.handleRetries();
      expect(deadLetter.findDueForRetry).not.toHaveBeenCalled();
      expect(notifications.notifyIfThresholdExceeded).not.toHaveBeenCalled();
    });
  });
});
