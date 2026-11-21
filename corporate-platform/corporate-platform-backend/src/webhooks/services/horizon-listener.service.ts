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
import { Horizon } from '@stellar/stellar-sdk';
import * as fs from 'fs';
import * as path from 'path';

const CURSOR_FILE_ENV = 'HORIZON_CURSOR_FILE';
const DEFAULT_CURSOR_FILE = path.join(process.cwd(), '.horizon-cursor');
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 60000;

@Injectable()
export class HorizonListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HorizonListenerService.name);
  private server?: Horizon.Server;
  private closeStream?: () => void;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private destroyed = false;
  private lastProcessedCursor?: string;
  private readonly cursorFile: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly stellarWebhookService: StellarWebhookService,
    private readonly dispatcherService: WebhookDispatcherService,
  ) {
    this.cursorFile = process.env[CURSOR_FILE_ENV] || DEFAULT_CURSOR_FILE;

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
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.closeStream) {
      this.closeStream();
      this.closeStream = undefined;
    }
  }

  private loadPersistedCursor(): string | undefined {
    try {
      if (!fs.existsSync(this.cursorFile)) {
        return undefined;
      }
      const value = fs.readFileSync(this.cursorFile, 'utf8').trim();
      return value.length > 0 ? value : undefined;
    } catch (error) {
      this.logger.error('Failed to read persisted Horizon cursor:', error);
      return undefined;
    }
  }

  private persistCursor(cursor: string) {
    try {
      const tmpFile = `${this.cursorFile}.tmp`;
      fs.writeFileSync(tmpFile, cursor, 'utf8');
      fs.renameSync(tmpFile, this.cursorFile);
      this.lastProcessedCursor = cursor;
    } catch (error) {
      this.logger.error('Failed to persist Horizon cursor:', error);
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) {
      return;
    }
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts += 1;
    this.logger.warn(
      `Reconnecting Horizon stream in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.startListening();
    }, delay);
  }

  private startListening() {
    if (!this.server || this.destroyed) {
      return;
    }

    // Close any previous stream before opening a new one
    if (this.closeStream) {
      try {
        this.closeStream();
      } catch (error) {
        this.logger.warn('Error closing previous Horizon stream:', error);
      }
      this.closeStream = undefined;
    }

    const persisted = this.loadPersistedCursor();
    const cursor = this.lastProcessedCursor ?? persisted ?? 'now';

    if (cursor === 'now') {
      this.logger.log(
        'No persisted Horizon cursor found; starting listener from "now"',
      );
    } else {
      this.logger.log(`Resuming Horizon listener from cursor ${cursor}`);
    }

    this.logger.log('Starting Horizon transaction listener...');

    try {
      this.closeStream = this.server
        .transactions()
        .cursor(cursor)
        .stream({
          onmessage: async (tx: Horizon.ServerApi.TransactionRecord) => {
            await this.handleTransaction(tx);
          },
          onerror: (error) => {
            this.logger.error('Horizon stream error:', error);
            if (this.closeStream) {
              try {
                this.closeStream();
              } catch {
                // ignore close errors on a failed stream
              }
              this.closeStream = undefined;
            }
            this.scheduleReconnect();
          },
        });
      this.reconnectAttempts = 0;
    } catch (error) {
      this.logger.error('Failed to start Horizon listener:', error);
      this.scheduleReconnect();
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

    // Persist cursor only after the transaction has been fully processed
    if (tx.paging_token) {
      this.persistCursor(tx.paging_token);
    }
  }
}
