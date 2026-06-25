import { Injectable, Logger } from '@nestjs/common';
import { CertificateDeadLetterService } from './certificate-dead-letter.service';

/**
 * CertificateFailureNotificationService (#400)
 *
 * Alerts the support/operations team when the backlog of unresolved certificate
 * anchoring failures crosses a configurable threshold. Delivery defaults to a
 * structured warn-level log (picked up by the platform's log-based alerting);
 * an optional webhook can be wired in via CERT_ANCHOR_ALERT_WEBHOOK_URL.
 */
@Injectable()
export class CertificateFailureNotificationService {
  private readonly logger = new Logger(
    CertificateFailureNotificationService.name,
  );

  constructor(private readonly deadLetter: CertificateDeadLetterService) {}

  /**
   * Check the unresolved-failure backlog and notify if it meets/exceeds the
   * configured alert threshold. Returns true when an alert was emitted.
   */
  async notifyIfThresholdExceeded(): Promise<boolean> {
    const { alertThreshold } = this.deadLetter.getConfig();
    const unresolved = await this.deadLetter.countUnresolved();

    if (unresolved < alertThreshold) return false;

    await this.dispatch(unresolved, alertThreshold);
    await this.deadLetter.markNotified();
    return true;
  }

  private async dispatch(unresolved: number, threshold: number): Promise<void> {
    const message =
      `Certificate anchoring failure backlog is ${unresolved}, ` +
      `which meets or exceeds the alert threshold of ${threshold}. ` +
      `Manual review may be required.`;

    this.logger.warn(`[ALERT] ${message}`);

    const webhookUrl = process.env.CERT_ANCHOR_ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'certificate_anchor_failure_threshold',
          unresolved,
          threshold,
          message,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      this.logger.error(
        `Failed to deliver certificate-failure alert webhook: ${(err as Error).message}`,
      );
    }
  }
}
