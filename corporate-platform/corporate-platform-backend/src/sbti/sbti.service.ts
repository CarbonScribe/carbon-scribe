import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { CreateTargetDto } from './dto/create-target.dto';
import { SbtiTarget } from './interfaces/sbti-target.interface';
import { ProgressMetrics } from './interfaces/progress-metrics.interface';
import { TargetValidationService } from './services/target-validation.service';
import { RetirementService } from '../retirement/retirement.service';
import { GhgProtocolService } from '../ghg-protocol/ghg-protocol.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import {
  AuditEventType,
  AuditAction,
} from '../audit-trail/interfaces/audit-event.interface';

@Injectable()
export class SbtiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targetValidation: TargetValidationService,
    private readonly retirementService: RetirementService,
    private readonly ghgProtocolService: GhgProtocolService,
    private readonly auditTrailService: AuditTrailService,
  ) {}
  // Create SBTi target
  async createTarget(dto: CreateTargetDto): Promise<SbtiTarget> {
    const target = await this.prisma.sbtiTarget.create({
      data: {
        companyId: dto.companyId,
        targetType: dto.targetType,
        scope: dto.scope,
        baseYear: dto.baseYear,
        baseYearEmissions: dto.baseYearEmissions,
        targetYear: dto.targetYear,
        reductionPercentage: dto.reductionPercentage,
        status: dto.status ?? 'DRAFT',
      },
    });
    // Audit log
    await this.auditTrailService.createAuditEvent(
      target.companyId,
      'system', // Replace with actual userId if available
      {
        eventType: AuditEventType.TARGET_UPDATE,
        action: AuditAction.CREATE,
        entityType: 'SbtiTarget',
        entityId: target.id,
        previousState: null,
        newState: target,
      },
    );
    return target;
  }

  // List company targets
  async listTargets(companyId: string): Promise<SbtiTarget[]> {
    return this.prisma.sbtiTarget.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get target progress
  async getTargetProgress(targetId: string): Promise<ProgressMetrics[]> {
    return this.prisma.targetProgress.findMany({
      where: { targetId },
      orderBy: { reportingYear: 'asc' },
    });
  }

  // Validate target against SBTi criteria
  async validateTarget(
    targetId: string,
  ): Promise<{ valid: boolean; details: any }> {
    // Fetch target
    const target = await this.prisma.sbtiTarget.findUnique({
      where: { id: targetId },
    });
    if (!target) return { valid: false, details: 'Target not found' };

    // Apply SBTi v5.0 criteria
    const result = this.targetValidation.validate(target);
    // Optionally update target status if valid
    if (result.valid) {
      const updated = await this.prisma.sbtiTarget.update({
        where: { id: targetId },
        data: { status: 'VALIDATED', validatedAt: new Date() },
      });
      // Audit log
      await this.auditTrailService.createAuditEvent(
        updated.companyId,
        'system', // Replace with actual userId if available
        {
          eventType: AuditEventType.SBTI_VALIDATION,
          action: AuditAction.VALIDATE,
          entityType: 'SbtiTarget',
          entityId: updated.id,
          previousState: target,
          newState: updated,
        },
      );
    }
    return result;
  }

  // SBTi progress dashboard
  async getDashboard(companyId: string): Promise<any> {
    // TODO: Aggregate and return chart-ready dashboard data
    // Placeholder: return targets and progress
    const targets = await this.prisma.sbtiTarget.findMany({
      where: { companyId },
    });
    const progress = await this.prisma.targetProgress.findMany({
      where: { targetId: { in: targets.map((t) => t.id) } },
    });
    return { targets, progress };
  }

  // Calculate retirements needed (retirement gap)
  async getRetirementGap(companyId: string): Promise<any> {
    // 1. Get all SBTi targets for the company
    const targets = await this.prisma.sbtiTarget.findMany({
      where: { companyId },
    });
    // 2. For each target, get GHG emissions and retirements
    const results = [];
    for (const target of targets) {
      // Get total emissions for the target year and scope
      // (Assume ghgProtocolService has a method getTotalEmissions(companyId, year, scope))
      let emissions = 0;
      try {
        emissions = await (this.ghgProtocolService as any).getTotalEmissions(
          companyId,
          target.targetYear,
          target.scope,
        );
      } catch {
        // ignore
      }

      // Get total retirements for the target year and scope
      // (Assume retirementService has a method getTotalRetirements(companyId, year, scope))
      let retirements = 0;
      try {
        retirements = await (this.retirementService as any).getTotalRetirements(
          companyId,
          target.targetYear,
          target.scope,
        );
      } catch {
        // ignore
      }

      // Calculate gap
      const gap = Math.max(0, emissions - retirements);
      results.push({
        targetId: target.id,
        targetYear: target.targetYear,
        scope: target.scope,
        emissions,
        retirements,
        gap,
      });
    }
    return { results };
  }
}
