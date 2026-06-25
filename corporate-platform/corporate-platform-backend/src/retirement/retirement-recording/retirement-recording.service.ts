import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class RetirementRecordingService {
  private readonly logger = new Logger(RetirementRecordingService.name);

  constructor(
    private readonly retirementTracker: RetirementTrackerService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Record a single retirement event on-chain.
   */
  async recordRetirement({
    tokenId,
    entity,
    reason,
    amount,
    userId,
  }: {
    tokenId: string;
    entity: string;
    reason: string;
    amount: number;
    userId: string;
  }) {
    // Prevent duplicate retirements (DB check)
    const existing = await this.prisma.retirement.findFirst({
      where: { creditId: tokenId },
    });
    if (existing) {
      throw new BadRequestException(
        'This token/credit has already been retired.',
      );
    }
    // TODO: Optionally check on-chain as well
    try {
      const result = await this.retirementTracker.invoke({
        companyId: entity, // Use entity as companyId for contract call
        methodName: 'retire',
        args: [tokenId, entity, reason, amount],
      });
      // Persist result in DB (simplified, extend as needed)
      const record = await this.prisma.retirement.create({
        data: {
          companyId: entity,
          userId,
          creditId: tokenId, // TODO: Map to actual creditId
          amount,
          purpose: reason,
          priceAtRetirement: 0,
          transactionHash: result?.transactionHash || null,
          retiredAt: new Date(),
        },
      });
      return { onChain: result, db: record };
    } catch (err) {
      this.logger.error('Retirement failed', err);
      throw new BadRequestException('Retirement failed: ' + err.message);
    }
  }

  /**
   * Record batch retirement events on-chain.
   */
  async batchRetire(
    retirements: Array<{
      tokenId: string;
      entity: string;
      reason: string;
      amount: number;
    }>,
    userId: string,
  ) {
    // Prevent duplicate retirements in batch
    const alreadyRetired = await this.prisma.retirement.findMany({
      where: { creditId: { in: retirements.map((r) => r.tokenId) } },
    });
    if (alreadyRetired.length > 0) {
      throw new BadRequestException(
        'One or more tokens/credits have already been retired: ' +
          alreadyRetired.map((r) => r.creditId).join(', '),
      );
    }
    try {
      // Use the first entity as companyId for batch (or require explicit companyId)
      const companyId = retirements[0]?.entity || 'unknown';
      const result = await this.retirementTracker.invoke({
        companyId,
        methodName: 'batch_retire',
        args: [retirements],
      });
      // Persist each retirement in DB (simplified)
      const records = await Promise.all(
        retirements.map((r) =>
          this.prisma.retirement.create({
            data: {
              companyId: r.entity,
              userId,
              creditId: r.tokenId, // TODO: Map to actual creditId
              amount: r.amount,
              purpose: r.reason,
              priceAtRetirement: 0,
              transactionHash: result?.transactionHash || null,
              retiredAt: new Date(),
            },
          }),
        ),
      );
      return { onChain: result, db: records };
    } catch (err) {
      this.logger.error('Batch retirement failed', err);
      throw new BadRequestException('Batch retirement failed: ' + err.message);
    }
  }
}
