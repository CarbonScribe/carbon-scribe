import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';
import { OwnershipHistoryService } from '../../../audit/ownership-history/ownership-history.service';
import { EventProcessorService } from '../../../audit/ownership-history/event-processor.service';
import { SorobanService } from '../../soroban.service';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class OwnershipEventListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OwnershipEventListener.name);
  private pollInterval?: NodeJS.Timeout;
  private lastLedger: number = 0;

  // Specific Carbon Asset contract ID from requirements
  private readonly CONTRACT_ID =
    'CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM';

  constructor(
    private readonly configService: ConfigService,
    private readonly historyService: OwnershipHistoryService,
    private readonly eventProcessor: EventProcessorService,
    private readonly sorobanService: SorobanService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      // Initialize lastLedger from database to ensure no skipped events
      const lastRecord = await this.prisma.creditOwnershipHistory.findFirst({
        orderBy: { ledgerSequence: 'desc' },
      });
      this.lastLedger = lastRecord
        ? lastRecord.ledgerSequence + 1
        : parseInt(process.env.OWNERSHIP_START_LEDGER || '0');
    } catch (err) {
      this.logger.warn(
        `Could not read last ledger from DB (table may not exist yet): ${err.message}. Starting from ledger ${process.env.OWNERSHIP_START_LEDGER || '0'}.`,
      );
      this.lastLedger = parseInt(process.env.OWNERSHIP_START_LEDGER || '0');
    }

    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private startPolling() {
    const interval = parseInt(process.env.SOROBAN_POLL_INTERVAL_MS || '10000');
    this.logger.log(
      `Starting Ownership Event Listener polling every ${interval}ms for ${this.CONTRACT_ID}...`,
    );

    this.pollInterval = setInterval(async () => {
      await this.pollContractEvents();
    }, interval);
  }

  /**
   * Main polling cycle
   */
  private async pollContractEvents() {
    try {
      this.logger.debug(
        `Polling events for ${this.CONTRACT_ID} from ledger ${this.lastLedger}...`,
      );

      const events = await this.sorobanService.getContractEvents(
        this.CONTRACT_ID,
        this.lastLedger,
      );

      for (const event of events) {
        await this.handleContractEvent(event);
      }

      // Update last ledger progress
      // this.lastLedger = latestSeenLedger;
    } catch (error) {
      this.logger.error(
        `Ownership polling failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Identifies event type and hands off processing
   */
  private async handleContractEvent(event: any) {
    // Topic is usually defined as SH256(event name) or raw name depending on Soroban version
    const topic = event.topic[0];
    const txHash = event.txHash;
    const ledger = event.ledger;
    const timestamp = event.ledgerClosedAt;

    // Decoding logic assuming standard Soroban event structure
    const decodedEvent = this.sorobanService.decodeScVal(event.value);

    let record = null;

    switch (topic) {
      case 'MintEvent':
        record = this.eventProcessor.processMintEvent(
          decodedEvent,
          txHash,
          ledger,
          timestamp,
        );
        break;
      case 'TransferEvent':
        record = this.eventProcessor.processTransferEvent(
          decodedEvent,
          txHash,
          ledger,
          timestamp,
        );
        break;
      case 'Sep41BurnEvent':
        record = this.eventProcessor.processBurnEvent(
          decodedEvent,
          txHash,
          ledger,
          timestamp,
        );
        break;
      case 'Sep41TransferEvent':
        record = this.eventProcessor.processSep41TransferEvent(
          decodedEvent,
          txHash,
          ledger,
          timestamp,
        );
        break;
      default:
        // Ignore other events for this module
        return;
    }

    if (record) {
      await this.historyService.recordOwnershipChange(record);
      this.logger.log(
        `Successfully recorded ${record.eventType} lineage for token ${record.tokenId}`,
      );
    }
  }

  /**
   * One-time sync for historical data
   */
  async syncHistoricalEvents() {
    this.logger.log(
      `Initiating historical sync backfill for Carbon Asset ownership from ledger 0...`,
    );

    let currentLedger = 0;
    let keepSyncing = true;

    while (keepSyncing) {
      this.logger.debug(`Backfilling events from ledger ${currentLedger}...`);
      const events = await this.sorobanService.getContractEvents(
        this.CONTRACT_ID,
        currentLedger,
      );

      if (events.length === 0) {
        keepSyncing = false;
        break;
      }

      for (const event of events) {
        await this.handleContractEvent(event);
        currentLedger = Math.max(currentLedger, event.ledger);
      }

      currentLedger += 1;

      // Safety break for demonstration or if ledger range is bounded
      if (currentLedger > this.lastLedger) {
        keepSyncing = false;
      }
    }

    this.logger.log(`Historical sync completed up to ledger ${currentLedger}`);
  }
}
