import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditTrailService } from '../../audit-trail/audit-trail.service';
import {
  AuditAction,
  AuditEventType,
} from '../../audit-trail/interfaces/audit-event.interface';
import { CreateMaterialityAssessmentDto } from '../dto/assessment.dto';
import {
  MaterialityAssessmentResult,
  MaterialityThresholds,
  MaterialityTopic,
} from '../interfaces/materiality.interface';

const DEFAULT_THRESHOLDS: MaterialityThresholds = { impact: 3, financial: 3 };

@Injectable()
export class MaterialityAssessmentService {
  private readonly logger = new Logger(MaterialityAssessmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async createAssessment(
    companyId: string,
    dto: CreateMaterialityAssessmentDto,
    userId = 'system',
  ) {
    const result = this.computeDoubleMateriality(dto.impacts, dto.risks);

    const assessment = await this.prisma.materialityAssessment.create({
      data: {
        companyId,
        assessmentYear: dto.assessmentYear,
        status: 'IN_PROGRESS',
        impacts: dto.impacts as any,
        risks: dto.risks as any,
        doubleMateriality: result as any,
        metadata: (dto.metadata as any) ?? null,
      },
    });

    await this.auditTrailService.createAuditEvent(companyId, userId, {
      eventType: AuditEventType.CSRD_DISCLOSURE,
      action: AuditAction.CREATE,
      entityType: 'MaterialityAssessment',
      entityId: assessment.id,
      newState: assessment,
      metadata: {
        assessmentYear: dto.assessmentYear,
        materialTopicsCount: result.materialTopics.length,
      },
    });

    return assessment;
  }

  async getCurrent(companyId: string) {
    return this.prisma.materialityAssessment.findFirst({
      where: { companyId },
      orderBy: { assessmentYear: 'desc' },
    });
  }

  async completeAssessment(
    assessmentId: string,
    companyId: string,
    userId = 'system',
  ) {
    const previous = await this.prisma.materialityAssessment.findFirst({
      where: { id: assessmentId, companyId },
    });

    const updated = await this.prisma.materialityAssessment.update({
      where: { id: assessmentId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await this.auditTrailService.createAuditEvent(companyId, userId, {
      eventType: AuditEventType.CSRD_DISCLOSURE,
      action: AuditAction.UPDATE,
      entityType: 'MaterialityAssessment',
      entityId: assessmentId,
      previousState: previous,
      newState: updated,
      metadata: { statusChange: 'COMPLETED' },
    });

    return updated;
  }

  private computeDoubleMateriality(
    impacts: MaterialityTopic[],
    risks: MaterialityTopic[],
    thresholds: MaterialityThresholds = DEFAULT_THRESHOLDS,
  ): MaterialityAssessmentResult {
    const topicMap = new Map<string, MaterialityTopic>();

    for (const topic of impacts) {
      topicMap.set(topic.id, {
        ...topic,
        isMaterial:
          topic.impactScore >= thresholds.impact ||
          topic.financialScore >= thresholds.financial,
      });
    }

    for (const topic of risks) {
      const existing = topicMap.get(topic.id);
      if (existing) {
        const mergedFinancial = Math.max(
          existing.financialScore,
          topic.financialScore,
        );
        topicMap.set(topic.id, {
          ...existing,
          financialScore: mergedFinancial,
          isMaterial:
            existing.impactScore >= thresholds.impact ||
            mergedFinancial >= thresholds.financial,
        });
      } else {
        topicMap.set(topic.id, {
          ...topic,
          isMaterial:
            topic.impactScore >= thresholds.impact ||
            topic.financialScore >= thresholds.financial,
        });
      }
    }

    const topics = Array.from(topicMap.values());
    const materialTopics = topics.filter((t) => t.isMaterial);

    const coverageByCategory = {
      environmental: materialTopics.filter(
        (t) => t.category === 'environmental',
      ).length,
      social: materialTopics.filter((t) => t.category === 'social').length,
      governance: materialTopics.filter((t) => t.category === 'governance')
        .length,
    };

    return {
      topics,
      materialTopics,
      overallSummary:
        `Identified ${materialTopics.length} material topics out of ` +
        `${topics.length} assessed. Environmental: ${coverageByCategory.environmental}, ` +
        `Social: ${coverageByCategory.social}, Governance: ${coverageByCategory.governance}.`,
      thresholds,
      coverageByCategory,
    };
  }
}
