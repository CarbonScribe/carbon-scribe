import { EventProcessorService } from './event-processor.service';
import { OwnershipEventType } from './interfaces/ownership.interface';

describe('EventProcessorService', () => {
  let service: EventProcessorService;

  beforeEach(() => {
    service = new EventProcessorService();
  });

  it('should process a Mint event correctly', () => {
    const event = {
      token_id: 42,
      owner: 'GABC...',
      project_id: 'PRJ1',
      vintage_year: 2024,
      methodology_id: 'M1',
    };
    const txHash = 'TX123';
    const ledger = 1000;
    const timestamp = 1711516800; // 2024-03-27

    const result = service.processMintEvent(event, txHash, ledger, timestamp);

    expect(result.tokenId).toBe(42);
    expect(result.newOwner).toBe('GABC...');
    expect(result.eventType).toBe(OwnershipEventType.MINT);
    expect(result.metadata.project_id).toBe('PRJ1');
  });

  it('should process a Transfer event correctly', () => {
    const event = {
      token_id: 42,
      from: 'GABC...',
      to: 'GXYZ...',
    };
    const txHash = 'TX456';
    const ledger = 1001;
    const timestamp = 1711517000;

    const result = service.processTransferEvent(event, txHash, ledger, timestamp);

    expect(result.tokenId).toBe(42);
    expect(result.previousOwner).toBe('GABC...');
    expect(result.newOwner).toBe('GXYZ...');
    expect(result.eventType).toBe(OwnershipEventType.TRANSFER);
  });
});
