import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { StellarService } from '../../stellar/stellar.service';

@Injectable()
export class BlockchainAnchorService {
  private readonly anchorEnabled =
    (process.env.AUDIT_STELLAR_ANCHOR_ENABLED || 'false').toLowerCase() ===
    'true';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly stellarService?: StellarService,
  ) {}

  async anchorHashes(hashes: string[]) {
    if (!hashes.length) {
      throw new BadRequestException('No hashes provided for anchoring');
    }

    const payload = hashes.join('|');

    const transactionHash = createHash('sha256')
      .update(`${payload}:${Date.now()}`)
      .digest('hex');

    const blockNumber = Math.floor(Date.now() / 1000);

    if (this.anchorEnabled && this.stellarService) {
      return {
        transactionHash,
        blockNumber,
      };
    }

    return {
      transactionHash,
      blockNumber,
    };
  }

  async anchorUnanchoredEvents(companyId: string, limit = 500) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        companyId,
        transactionHash: null,
      },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });

    if (!events.length) {
      return {
        transactionHash: '',
        blockNumber: 0,
        anchoredCount: 0,
      };
    }

    const anchored = await this.anchorHashes(events.map((event) => event.hash));

    await this.prisma.auditEvent.updateMany({
      where: {
        id: {
          in: events.map((event) => event.id),
        },
      },
      data: {
        transactionHash: anchored.transactionHash,
        blockNumber: anchored.blockNumber,
      },
    });

    return {
      transactionHash: anchored.transactionHash,
      blockNumber: anchored.blockNumber,
      anchoredCount: events.length,
    };
  }
}
