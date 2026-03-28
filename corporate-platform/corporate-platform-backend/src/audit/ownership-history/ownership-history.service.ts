import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { IOwnershipHistoryRecord } from './interfaces/ownership.interface';

@Injectable()
export class OwnershipHistoryService {
  private readonly logger = new Logger(OwnershipHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds an ownership history record and updates the current owner
   * 
   * @time O(1) - optimized via targeted primary key and unique updates
   * @space O(1) - incremental growth per ownership event
   */
  async recordOwnershipChange(record: IOwnershipHistoryRecord): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Create the persistent history record
        await tx.creditOwnershipHistory.create({
          data: {
            tokenId: record.tokenId,
            companyId: record.companyId,
            previousOwner: record.previousOwner,
            newOwner: record.newOwner,
            eventType: record.eventType,
            transactionHash: record.transactionHash,
            blockNumber: record.blockNumber,
            ledgerSequence: record.ledgerSequence,
            metadata: record.metadata || {},
            timestamp: record.timestamp,
          },
        });

        // 2. Upsert the current owner reference
        // Handle RETIREMENT specially - if burned, current owner index might need special status
        // For now, based on requirements, we track owner field
        await tx.creditCurrentOwner.upsert({
          where: { tokenId: record.tokenId },
          update: { 
            owner: record.newOwner,
            lastUpdated: record.timestamp,
          },
          create: {
            tokenId: record.tokenId,
            owner: record.newOwner,
            lastUpdated: record.timestamp,
          },
        });
      });

      this.logger.debug(`Recorded ${record.eventType} for token ${record.tokenId}: ${record.previousOwner} -> ${record.newOwner}`);
    } catch (error) {
      this.logger.error(`Failed to record ownership change for token ${record.tokenId}`, error.stack);
      throw error;
    }
  }

  /**
   * Batch upserts current owners during historical sync
   */
  async batchUpdateCurrentOwners(records: { tokenId: number; owner: string; timestamp: Date }[]): Promise<void> {
    // Optimization to avoid multiple transactions during heavy backfill
    for (const record of records) {
      await this.prisma.creditCurrentOwner.upsert({
        where: { tokenId: record.tokenId },
        update: { 
          owner: record.owner,
          lastUpdated: record.timestamp,
        },
        create: {
          tokenId: record.tokenId,
          owner: record.owner,
          lastUpdated: record.timestamp,
        },
      });
    }
  }
}
