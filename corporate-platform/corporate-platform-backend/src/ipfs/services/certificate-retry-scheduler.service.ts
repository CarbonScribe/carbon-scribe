import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CertificateDeadLetterService } from './certificate-dead-letter.service';
import { CertificateIpfsService } from './certificate-ipfs.service';
import { CertificateFailureNotificationService } from './certificate-failure-notification.service';
import { CertificateFailureStatus } from '../interfaces/certificate-failure.interface';

/**
 * CertificateRetrySchedulerService (#400)
 *
 * Periodically reprocesses dead-lettered certificate anchoring failures. Each
 * due record is claimed (to guard against overlapping runs), re-anchored via
 * {@link CertificateIpfsService.performAnchor}, and then marked RESOLVED on
 * success or rescheduled with exponential backoff on failure. After each sweep
 * it asks the notification service to alert support if the unresolved backlog
 * crosses the configured threshold.
 *
 * The schedule can be disabled with CERT_ANCHOR_RETRY_ENABLED=false.
 */
@Injectable()
export class CertificateRetrySchedulerService {
  private readonly logger = new Logger(CertificateRetrySchedulerService.name);
  private running = false;

  constructor(
    private readonly deadLetter: CertificateDeadLetterService,
    private readonly certificateIpfs: CertificateIpfsService,
    private readonly notifications: CertificateFailureNotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleRetries(): Promise<void> {
    if (process.env.CERT_ANCHOR_RETRY_ENABLED === 'false') return;
    // Guard against overlapping executions if a sweep runs long.
    if (this.running) return;
    this.running = true;

    try {
      const due = await this.deadLetter.findDueForRetry();
      if (due.length > 0) {
        this.logger.log(
          `Reprocessing ${due.length} dead-lettered certificate anchor(s)`,
        );
        for (const record of due) {
          await this.processOne(record.id);
        }
      }

      await this.notifications.notifyIfThresholdExceeded();
    } catch (err) {
      this.logger.error(
        `Certificate retry sweep failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Reprocess a single failure record. Exposed for the manual recovery endpoint
   * so admins can force an immediate retry. Returns the outcome.
   */
  async processOne(
    id: string,
  ): Promise<{ id: string; resolved: boolean; cid?: string; error?: string }> {
    const claimed = await this.deadLetter.claimForProcessing(id);
    if (!claimed) {
      // Already being processed elsewhere, or no longer exists.
      return { id, resolved: false, error: 'not-claimable' };
    }

    if (claimed.status === CertificateFailureStatus.RESOLVED) {
      return { id, resolved: true, cid: claimed.resolvedCid ?? undefined };
    }

    try {
      const result: any = await this.certificateIpfs.performAnchor(
        claimed.retirementId ?? '',
        claimed.certificateData,
      );
      const cid = result?.cid;
      await this.deadLetter.markResolved(id, cid);
      this.logger.log(
        `Certificate anchor recovered (id=${id}${cid ? `, cid=${cid}` : ''})`,
      );
      return { id, resolved: true, cid };
    } catch (err) {
      const message = (err as Error).message;
      const updated = await this.deadLetter.markRetryFailed(id, message);
      this.logger.warn(
        `Certificate anchor retry failed (id=${id}, attempts=${updated.attemptCount}, status=${updated.status}): ${message}`,
      );
      return { id, resolved: false, error: message };
    }
  }
}
