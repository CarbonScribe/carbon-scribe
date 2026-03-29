import { Injectable, Logger } from '@nestjs/common';
import {
  IOwnershipHistoryRecord,
  OwnershipEventType,
} from './interfaces/ownership.interface';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  /**
   * Process a Mint event from Soroban contract
   */
  processMintEvent(
    event: any,
    txHash: string,
    ledger: number,
    timestamp: number,
  ): IOwnershipHistoryRecord {
    const tokenId = event.token_id;
    const owner = event.owner;

    return {
      tokenId,
      companyId: null, // To be resolved via separate logic if needed
      previousOwner: '0x0000000000000000000000000000000000000000', // Burn/Mint address
      newOwner: owner,
      eventType: OwnershipEventType.MINT,
      transactionHash: txHash,
      blockNumber: ledger,
      ledgerSequence: ledger,
      metadata: {
        project_id: event.project_id,
        vintage: event.vintage_year,
        methodology: event.methodology_id,
      },
      timestamp: new Date(timestamp * 1000),
    };
  }

  /**
   * Process a Transfer event from Soroban contract
   */
  processTransferEvent(
    event: any,
    txHash: string,
    ledger: number,
    timestamp: number,
  ): IOwnershipHistoryRecord {
    return {
      tokenId: event.token_id,
      companyId: null,
      previousOwner: event.from,
      newOwner: event.to,
      eventType: OwnershipEventType.TRANSFER,
      transactionHash: txHash,
      blockNumber: ledger,
      ledgerSequence: ledger,
      metadata: {},
      timestamp: new Date(timestamp * 1000),
    };
  }

  /**
   * Process a Burn event from Soroban contract
   */
  processBurnEvent(
    event: any,
    txHash: string,
    ledger: number,
    timestamp: number,
  ): IOwnershipHistoryRecord {
    return {
      tokenId: 0, // Resolve tokenId from lookup for balanced-based events or special mapping
      companyId: null,
      previousOwner: event.from,
      newOwner: '0x0000000000000000000000000000000000000000', // Burn address
      eventType: OwnershipEventType.RETIREMENT,
      transactionHash: txHash,
      blockNumber: ledger,
      ledgerSequence: ledger,
      metadata: {
        amount: event.amount ? event.amount.toString() : '0',
      },
      timestamp: new Date(timestamp * 1000),
    };
  }

  /**
   * Process an amount-based Transfer event (SEP-41)
   */
  processSep41TransferEvent(
    event: any,
    txHash: string,
    ledger: number,
    timestamp: number,
  ): IOwnershipHistoryRecord {
    return {
      tokenId: 0, // Maps to balance, might need special handling
      companyId: null,
      previousOwner: event.from,
      newOwner: event.to,
      eventType: OwnershipEventType.TRANSFER,
      transactionHash: txHash,
      blockNumber: ledger,
      ledgerSequence: ledger,
      metadata: {
        amount: event.amount ? event.amount.toString() : '0',
      },
      timestamp: new Date(timestamp * 1000),
    };
  }
}
