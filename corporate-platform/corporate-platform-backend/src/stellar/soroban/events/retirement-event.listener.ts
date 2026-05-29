import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { RetirementTrackerService } from '../contracts/retirement-tracker.service';
import { PrismaService } from '../../../shared/database/prisma.service';

@Injectable()
export class RetirementEventListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetirementEventListener.name);
  private pollInterval?: NodeJS.Timeout;
  private lastLedger: number = 1;
  private readonly CONTRACT_ID: string;

  constructor(
    private readonly retirementTracker: RetirementTrackerService,
    private readonly prisma: PrismaService,
  ) {
    this.CONTRACT_ID = this.retirementTracker.getContractId();
  }

  async onModuleInit() {
    try {
      // No ledgerSequence in Retirement model; just start from 1 or latest
      const lastRecord = await this.prisma.retirement.findFirst({
        orderBy: { retiredAt: 'desc' },
      });
      if (lastRecord && lastRecord.retiredAt) {
        // Optionally, you could store last processed ledger in a config table
        this.logger.log(
          `Last retirement in DB at ${lastRecord.retiredAt}. Starting polling from ledger 1 (customize as needed).`,
        );
      } else {
        const latestSeq = 1; // Optionally fetch from SorobanService
        this.lastLedger = latestSeq > 0 ? latestSeq : 1;
        this.logger.log(
          `No retirement history in DB; bootstrapping Soroban listener from current ledger ${this.lastLedger}.`,
        );
      }
    } catch (err) {
      this.lastLedger = 1;
      this.logger.warn(
        `Could not read last ledger from DB (table may not exist yet): ${err.message}. Starting from ledger ${this.lastLedger}.`,
      );
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
      `Starting Retirement Event Listener polling every ${interval}ms for ${this.CONTRACT_ID}...`,
    );
    this.pollInterval = setInterval(async () => {
      await this.pollContractEvents();
    }, interval);
  }

  private async pollContractEvents() {
    try {
      this.logger.debug(
        `Polling retirement events for ${this.CONTRACT_ID} from ledger ${this.lastLedger}...`,
      );
      // TODO: Replace with actual SorobanService event fetch for retirements
      const events = await this.retirementTracker.simulate({
        methodName: 'get_recent_retirements',
        args: [
          {
            type: 'u32',
            value: '100',
          },
        ],
      });
      const result = (events as any).result || [];
      let latestSeenLedger = this.lastLedger - 1;
      for (const event of result) {
        await this.handleRetirementEvent(event);
        const eventLedger = Number.parseInt(String(event.ledger), 10);
        if (Number.isFinite(eventLedger)) {
          latestSeenLedger = Math.max(latestSeenLedger, eventLedger);
        }
      }
      if (latestSeenLedger >= this.lastLedger) {
        this.lastLedger = latestSeenLedger + 1;
      }
    } catch (error) {
      this.logger.error(
        `Retirement polling failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleRetirementEvent(event: any) {
    // Normalize and persist event
    try {
      // transactionHash is not unique, so just create if not exists
      const exists = event.txHash
        ? await this.prisma.retirement.findFirst({
            where: { transactionHash: event.txHash },
          })
        : null;
      if (!exists) {
        await this.prisma.retirement.create({
          data: {
            companyId: event.entity || event.retired_by || 'unknown',
            userId: 'system', // Not available on-chain; use a placeholder
            creditId: event.tokenId || event.token_id || 'unknown',
            amount: Number(event.amount || 0),
            purpose: event.reason || event.purpose || '',
            priceAtRetirement: 0,
            transactionHash: event.txHash || null,
            retiredAt: event.retiredAt || event.timestamp || new Date(),
          },
        });
        this.logger.log(
          `Recorded retirement event for token ${event.tokenId || event.token_id} (tx: ${event.txHash})`,
        );
      } else {
        this.logger.debug(
          `Retirement event for tx ${event.txHash} already exists, skipping.`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to record retirement event', err);
    }
  }
}
