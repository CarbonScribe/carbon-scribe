import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
// Fixed linting issues
import { ConfigService } from '../../config/config.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { SorobanEventDto } from '../dto/soroban-event.dto';

@Injectable()
export class SorobanEventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SorobanEventService.name);
  private pollInterval?: NodeJS.Timeout;
  private lastLedger: number = 1;

  constructor(
    private readonly configService: ConfigService,
    private readonly dispatcherService: WebhookDispatcherService,
  ) {
    const configuredStartLedger = Number.parseInt(
      process.env.SOROBAN_START_LEDGER || '1',
      10,
    );
    this.lastLedger = Math.max(
      1,
      Number.isFinite(configuredStartLedger) ? configuredStartLedger : 1,
    );
  }

  onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private startPolling() {
    const interval = parseInt(process.env.SOROBAN_POLL_INTERVAL_MS || '10000');
    this.logger.log(`Starting Soroban event polling every ${interval}ms...`);

    this.pollInterval = setInterval(async () => {
      await this.pollEvents();
    }, interval);
  }

  private async pollEvents() {
    try {
      // This is a simplified representation of calling Soroban RPC getEvents
      // In a real implementation, you'd use the Stellar SDK's SorobanRpc.Server
      const stellarConfig = this.configService.getStellarConfig();
      if (!stellarConfig.horizonUrl) return; // Need Soroban RPC URL really

      // Mocking the RPC call for this implementation
      this.logger.debug(
        `Polling Soroban events from ledger ${this.lastLedger}...`,
      );

      // Assume we got some events
      const mockEvents: SorobanEventDto[] = [];

      for (const event of mockEvents) {
        await this.handleEvent(event);
      }

      // Update last ledger (would come from RPC response)
      // this.lastLedger = latestLedger;
    } catch (error) {
      this.logger.error('Soroban event polling failed:', error.message);
    }
  }

  private async handleEvent(event: SorobanEventDto) {
    this.logger.log(
      `Detected Soroban event: ${event.type} from contract ${event.contractId}`,
    );

    await this.dispatcherService.dispatch({
      eventType: `contract.${event.type.toLowerCase()}`,
      timestamp: event.ledgerClosedAt,
      data: {
        id: event.id,
        contractId: event.contractId,
        topic: event.topic,
        value: event.value.xdr,
        ledger: event.ledger,
      },
    });
  }
}
