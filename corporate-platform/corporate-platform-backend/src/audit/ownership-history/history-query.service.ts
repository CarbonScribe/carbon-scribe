import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { IOwnershipHistoryRecord, IOwnershipVerification } from './interfaces/ownership.interface';

@Injectable()
export class HistoryQueryService {
  private readonly logger = new Logger(HistoryQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves full lineage for a specific token
   * @time O(N) where N is ownership changes
   */
  async getFullHistory(tokenId: number): Promise<any[]> {
    const history = await this.prisma.creditOwnershipHistory.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'asc' },
    });

    if (!history || history.length === 0) {
      throw new NotFoundException(`No history found for token ID ${tokenId}`);
    }

    return history;
  }

  /**
   * Gets current owner information
   * @time O(1) via unique index
   */
  async getCurrentOwner(tokenId: number): Promise<any> {
    const owner = await this.prisma.creditCurrentOwner.findUnique({
      where: { tokenId },
    });

    if (!owner) {
      throw new NotFoundException(`Current owner not tracked for token ID ${tokenId}`);
    }

    return owner;
  }

  /**
   * Retrieves all tokens currently owned by a company
   * @time O(M) where M is company holdings
   */
  async getCompanyTokens(companyId: string, companyAddress: string): Promise<any> {
    // Note: companies are identified by their on-chain Addresses
    return this.prisma.creditCurrentOwner.findMany({
      where: { owner: companyAddress },
    });
  }

  /**
   * Gets all historical records where company participated as owner
   */
  async getCompanyHistory(companyAddress: string): Promise<any[]> {
    return this.prisma.creditOwnershipHistory.findMany({
      where: {
        OR: [
          { previousOwner: companyAddress },
          { newOwner: companyAddress },
        ],
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Verifies ownership lineage for compliance
   */
  async verifyOwnershipLineage(tokenId: number): Promise<IOwnershipVerification> {
    const history = await this.prisma.creditOwnershipHistory.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'asc' },
    });

    if (history.length === 0) {
      return {
        tokenId,
        currentOwner: null,
        lineage: [],
        isVerified: false,
      };
    }

    // A simple verification logic for consistency
    // e.g., ensure each subsequent previousOwner matches prior newOwner
    let isVerified = true;
    for (let i = 1; i < history.length; i++) {
      if (history[i].previousOwner !== history[i-1].newOwner) {
        isVerified = false;
        this.logger.warn(`Gap detected in lineage for token ${tokenId} between record ${i-1} and ${i}`);
        break;
      }
    }

    const currentRecord = history[history.length - 1];

    return {
      tokenId,
      currentOwner: currentRecord.newOwner,
      lineage: history as unknown as IOwnershipHistoryRecord[],
      isVerified,
    };
  }
}
