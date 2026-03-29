import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { StellarWebhookService } from './stellar-webhook.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { TransactionStatus } from '../interfaces/webhook.interface';
import { Horizon } from 'stellar-sdk';

@Injectable()
export class HorizonListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HorizonListenerService.name);
  private server?: Horizon.Server;
  private closeStream?: () => void;

  constructor(
    private readonly configService: ConfigService,
    private readonly stellarWebhookService: StellarWebhookService,
    private readonly dispatcherService: WebhookDispatcherService,
  ) {
    const stellarConfig = this.configService.getStellarConfig();
    if (!stellarConfig.horizonUrl) {
      this.logger.warn(
        'HORIZON_URL is not configured. Horizon transaction listener is disabled.',
      );
      return;
    }

    this.server = new Horizon.Server(stellarConfig.horizonUrl);
  }

  onModuleInit() {
    this.startListening();
  }

  onModuleDestroy() {
    if (this.closeStream) {
      this.closeStream();
    }
  }

  private startListening() {
    if (!this.server) {
      return;
    }

    this.logger.log('Starting Horizon transaction listener...');

    try {
      this.closeStream = this.server
        .transactions()
        .cursor('now')
        .stream({
          onmessage: async (tx: Horizon.ServerApi.TransactionRecord) => {
            await this.handleTransaction(tx);
          },
          onerror: (error) => {
            this.logger.error('Horizon stream error:', error);
            // Reconnect logic would go here if needed, but SDK usually handles it
          },
        });
    } catch (error) {
      this.logger.error('Failed to start Horizon listener:', error);
    }
  }

  private async handleTransaction(tx: Horizon.ServerApi.TransactionRecord) {
    this.logger.log(`Detected transaction on network: ${tx.hash}`);

    const status = tx.successful
      ? TransactionStatus.CONFIRMED
      : TransactionStatus.FAILED;

    // Update local database
    const updated = await this.stellarWebhookService.updateTransactionStatus(
      tx.hash,
      status,
      tx.ledger_attr,
    );

    if (updated) {
      this.logger.log(`Transaction ${tx.hash} status updated to ${status}`);

      // Dispatch internal event for handlers
      await this.dispatcherService.dispatch({
        eventType: `transaction.${status.toLowerCase()}`,
        timestamp: tx.created_at,
        data: {
          hash: tx.hash,
          ledger: tx.ledger_attr,
          operationType: updated.operationType,
          companyId: updated.companyId,
          metadata: updated.metadata,
        },
      });
    }
  }
}
