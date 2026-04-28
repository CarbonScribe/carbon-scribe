import { Injectable } from '@nestjs/common';
import { AuditEvent, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateAuditEventInput } from '../interfaces/audit-event.interface';

const GENESIS_HASH = 'GENESIS';

@Injectable()
export class EventLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(input: CreateAuditEventInput): Promise<AuditEvent> {
    const timestamp = input.timestamp || new Date();

    return this.prisma.$transaction(async (tx) => {
      const previousEvent = await tx.auditEvent.findFirst({
        where: { companyId: input.companyId },
        orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }],
      });

      const previousHash = previousEvent?.hash || GENESIS_HASH;
      const previousState = this.serializeState(input.previousState);
      const newState = this.serializeState(input.newState);
      const metadata = (this.serializeState(input.metadata || {}) ||
        {}) as Prisma.InputJsonValue;

      const hash = this.calculateHash({
        companyId: input.companyId,
        userId: input.userId,
        eventType: input.eventType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        previousState,
        newState,
        metadata,
        previousHash,
        timestamp: timestamp.toISOString(),
      });

      return tx.auditEvent.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          eventType: input.eventType,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          previousState: previousState as Prisma.InputJsonValue,
          newState: newState as Prisma.InputJsonValue,
          metadata,
          previousHash,
          hash,
          timestamp,
        },
      });
    });
  }

  recalculateHash(event: {
    companyId: string;
    userId: string;
    eventType: string;
    action: string;
    entityType: string;
    entityId: string;
    previousState: Prisma.JsonValue;
    newState: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    previousHash: string;
    timestamp: Date;
  }) {
    return this.calculateHash({
      companyId: event.companyId,
      userId: event.userId,
      eventType: event.eventType,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      previousState: this.serializeState(event.previousState),
      newState: this.serializeState(event.newState),
      metadata: this.serializeState(event.metadata),
      previousHash: event.previousHash,
      timestamp: event.timestamp.toISOString(),
    });
  }

  calculateHash(payload: Record<string, unknown>) {
    return createHash('sha256')
      .update(this.stableStringify(payload))
      .digest('hex');
  }

  serializeState(value: unknown): Prisma.JsonValue {
    const normalized = this.normalizeValue(value);
    if (typeof normalized === 'undefined') {
      return null;
    }

    return normalized as Prisma.JsonValue;
  }

  private stableStringify(value: unknown) {
    return JSON.stringify(this.normalizeValue(value));
  }

  private normalizeValue(value: unknown): unknown {
    if (value === null || typeof value === 'undefined') {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.normalizeValue(entry));
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, current]) => typeof current !== 'undefined')
        .sort(([a], [b]) => a.localeCompare(b));

      const normalized: Record<string, unknown> = {};
      for (const [key, current] of entries) {
        normalized[key] = this.normalizeValue(current);
      }

      return normalized;
    }

    return value;
  }
}
