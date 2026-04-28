import { Injectable } from '@nestjs/common';
import { SorobanService } from '../soroban.service';

@Injectable()
export class EventListenerService {
  constructor(private readonly sorobanService: SorobanService) {}

  async getContractEvents(contractId: string, startLedger = 1, limit = 100) {
    const events = await this.sorobanService.getContractEvents(
      contractId,
      startLedger,
    );

    return events.slice(0, Math.max(1, Math.min(limit, 500))).map((event) => ({
      id: event.id,
      ledger: Number(event.ledger || 0),
      txHash: event.txHash,
      topic: event.topic,
      value: this.sorobanService.decodeScVal(event.value),
      contractId,
      ledgerClosedAt: event.ledgerClosedAt,
    }));
  }
}
