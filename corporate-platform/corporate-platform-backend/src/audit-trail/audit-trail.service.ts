import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent } from '@prisma/client';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AuditQueryResult } from './interfaces/audit-query.interface';
import { BlockchainAnchorService } from './services/blockchain-anchor.service';
import { EventLoggerService } from './services/event-logger.service';
import { IntegrityVerifierService } from './services/integrity-verifier.service';
import { RetentionManagerService } from './services/retention-manager.service';
import { PrismaService } from '../shared/database/prisma.service';

@Injectable()
export class AuditTrailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
    private readonly integrityVerifier: IntegrityVerifierService,
    private readonly blockchainAnchor: BlockchainAnchorService,
    private readonly retentionManager: RetentionManagerService,
  ) {}

  async createAuditEvent(
    companyId: string,
    userId: string,
    dto: CreateAuditLogDto,
    metadata: Record<string, unknown> = {},
  ) {
    const event = await this.eventLogger.recordEvent({
      companyId,
      userId,
      eventType: dto.eventType,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      previousState: dto.previousState,
      newState: dto.newState,
      metadata,
    });

    await this.retentionManager.enforceRetention(companyId);

    return event;
  }

  async recordDecoratedAuditEvent(payload: {
    eventType: string;
    action: string;
    entityType: string;
    entityId: string;
    previousState?: unknown;
    newState?: unknown;
    metadata?: Record<string, unknown>;
    companyId?: string;
    userId?: string;
  }) {
    if (!payload.companyId || !payload.userId) {
      return null;
    }

    return this.eventLogger.recordEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      eventType: payload.eventType,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      previousState: payload.previousState,
      newState: payload.newState,
      metadata: payload.metadata,
    });
  }

  async queryEvents(
    companyId: string,
    query: QueryAuditLogsDto,
  ): Promise<AuditQueryResult<AuditEvent>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 1000) : 20;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
    };

    if (query.userId) where.userId = query.userId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.from || query.to) {
      where.timestamp = {};
      if (query.from) where.timestamp.gte = new Date(query.from);
      if (query.to) where.timestamp.lte = new Date(query.to);
    }

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      events,
      total,
      page,
      limit,
    };
  }

  async getEventById(companyId: string, id: string) {
    const event = await this.prisma.auditEvent.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!event) {
      throw new NotFoundException('Audit event not found');
    }

    return event;
  }

  async getEntityTrail(
    companyId: string,
    entityType: string,
    entityId: string,
  ) {
    return this.prisma.auditEvent.findMany({
      where: {
        companyId,
        entityType,
        entityId,
      },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async verifyEventIntegrity(companyId: string, id: string) {
    return this.integrityVerifier.verifyEvent(companyId, id);
  }

  async verifyBatchIntegrity(companyId: string, ids: string[]) {
    return this.integrityVerifier.verifyBatch(companyId, ids);
  }

  async verifyChainIntegrity(companyId: string) {
    return this.integrityVerifier.verifyChain(companyId);
  }

  async anchor(companyId: string) {
    return this.blockchainAnchor.anchorUnanchoredEvents(companyId);
  }

  async exportEvents(companyId: string, query: QueryAuditLogsDto) {
    const exportQuery: QueryAuditLogsDto = {
      ...query,
      page: 1,
      limit:
        query.limit && query.limit > 0 ? Math.min(query.limit, 100000) : 100000,
    };

    return this.queryEvents(companyId, exportQuery);
  }
}
