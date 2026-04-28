import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { IntegrityProof } from '../interfaces/integrity-proof.interface';
import { EventLoggerService } from './event-logger.service';

@Injectable()
export class IntegrityVerifierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  async verifyEvent(companyId: string, eventId: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: {
        id: eventId,
        companyId,
      },
    });

    if (!event) {
      throw new NotFoundException('Audit event not found');
    }

    const previousEvent = await this.prisma.auditEvent.findFirst({
      where: {
        companyId,
        timestamp: { lt: event.timestamp },
      },
      orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }],
    });

    const computedHash = this.eventLogger.recalculateHash(event);
    const expectedPreviousHash = previousEvent?.hash || 'GENESIS';

    const proof: IntegrityProof = {
      eventId: event.id,
      expectedHash: event.hash,
      computedHash,
      previousHash: event.previousHash,
      expectedPreviousHash,
      hashValid: computedHash === event.hash,
      chainLinkValid: event.previousHash === expectedPreviousHash,
      anchored: Boolean(event.transactionHash),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      checkedAt: new Date(),
    };

    return {
      valid: proof.hashValid && proof.chainLinkValid,
      message:
        proof.hashValid && proof.chainLinkValid
          ? 'Audit event integrity verified'
          : 'Audit event integrity validation failed',
      proof,
    };
  }

  async verifyBatch(companyId: string, eventIds: string[]) {
    const checks = await Promise.all(
      eventIds.map(async (eventId) => {
        const result = await this.verifyEvent(companyId, eventId);
        return {
          eventId,
          valid: result.valid,
        };
      }),
    );

    return {
      valid: checks.every((check) => check.valid),
      invalidRecords: checks
        .filter((check) => !check.valid)
        .map((check) => check.eventId),
    };
  }

  async verifyChain(companyId: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: { companyId },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
    });

    let previousHash = 'GENESIS';
    const brokenLinks: string[] = [];

    for (const event of events) {
      const computedHash = this.eventLogger.recalculateHash(event);
      const hashValid = computedHash === event.hash;
      const linkValid = event.previousHash === previousHash;

      if (!hashValid || !linkValid) {
        brokenLinks.push(event.id);
      }

      previousHash = event.hash;
    }

    return {
      valid: brokenLinks.length === 0,
      brokenLinks,
    };
  }
}
