import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../shared/database/prisma.service';
import {
  AuditAction,
  AuditEventType,
} from '../audit-trail/interfaces/audit-event.interface';
import {
  CalculateEmissionDto,
  CreateEmissionSourceDto,
  RecordEmissionDto,
} from './dto/record-emission.dto';
import {
  EmissionFactorsQueryDto,
  EmissionSourceQueryDto,
  InventoryQueryDto,
  TrendsQueryDto,
} from './dto/inventory-query.dto';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { EmissionFactorsService } from './services/emission-factors.service';
import { InventoryService } from './services/inventory.service';
import { Scope1Service } from './services/scope1.service';
import { Scope2Service } from './services/scope2.service';
import { Scope3Service } from './services/scope3.service';
import { FrameworkValidationSummary } from './interfaces/inventory.interface';
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';

@Injectable()
export class GhgProtocolService {
  private readonly logger = new Logger(GhgProtocolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope1Service: Scope1Service,
    private readonly scope2Service: Scope2Service,
    private readonly scope3Service: Scope3Service,
    private readonly emissionFactorsService: EmissionFactorsService,
    private readonly inventoryService: InventoryService,
    private readonly auditTrailService: AuditTrailService,
    private readonly retirementVerificationService: RetirementVerificationService,
  ) {}

  async createSource(
    companyId: string,
    dto: CreateEmissionSourceDto,
    actor: JwtPayload,
  ) {
    this.assertCompanyId(companyId);
    this.assertScope(dto.scope);

    const source = await this.prisma.emissionSource.create({
      data: {
        companyId,
        scope: dto.scope,
        category: dto.category,
        name: dto.name,
        activityType: dto.activityType.toUpperCase(),
        unit: dto.unit,
        methodology: dto.methodology,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.auditTrailService.createAuditEvent(companyId, actor.sub, {
      eventType: AuditEventType.GHG_CALCULATION,
      action: AuditAction.CREATE,
      entityType: 'EmissionSource',
      entityId: source.id,
      newState: source,
      metadata: {
        scope: source.scope,
        category: source.category,
      },
    });

    return source;
  }

  async listSources(companyId: string, query: EmissionSourceQueryDto) {
    this.assertCompanyId(companyId);

    return this.prisma.emissionSource.findMany({
      where: {
        companyId,
        scope: query.scope,
        isActive:
          typeof query.isActive === 'boolean' ? query.isActive : undefined,
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
  }

  async recordEmission(
    companyId: string,
    dto: RecordEmissionDto,
    actor: JwtPayload,
  ) {
    this.assertCompanyId(companyId);
    const source = await this.getSourceOrThrow(companyId, dto.sourceId);
    const period = this.parsePeriod(dto.periodStart, dto.periodEnd);
    const unit = dto.unit || source.unit;

    if (unit !== source.unit) {
      throw new BadRequestException(
        `Unit mismatch for source ${source.id}. Expected ${source.unit}.`,
      );
    }

    const calculation = await this.calculateForSource(companyId, source, dto);
    const record = await this.prisma.emissionRecord.create({
      data: {
        companyId,
        sourceId: source.id,
        periodStart: period.start,
        periodEnd: period.end,
        activityValue: dto.activityValue,
        unit,
        emissionFactor: calculation.emissionFactor,
        factorSource: calculation.factor.source,
        factorRegion: calculation.factor.region,
        co2e: calculation.co2e,
        verified: dto.verified ?? false,
        metadata: {
          methodology: calculation.methodology,
          factorMethodology: calculation.factor.methodology,
          ...((dto.metadata || {}) as Record<string, unknown>),
          ...(calculation.details as Record<string, unknown>),
        } as Prisma.InputJsonValue,
      },
      include: { source: true },
    });

    await this.auditTrailService.createAuditEvent(companyId, actor.sub, {
      eventType: AuditEventType.GHG_CALCULATION,
      action: AuditAction.CREATE,
      entityType: 'EmissionRecord',
      entityId: record.id,
      newState: record,
      metadata: {
        sourceId: source.id,
        scope: source.scope,
        co2e: record.co2e,
        methodology: calculation.methodology,
      },
    });

    return {
      record,
      frameworkValidation: calculation.frameworkValidation,
    };
  }

  async calculate(
    companyId: string,
    dto: CalculateEmissionDto,
    actor?: JwtPayload,
  ) {
    this.assertCompanyId(companyId);
    const source = await this.getSourceOrThrow(companyId, dto.sourceId);
    const calculation = await this.calculateForSource(companyId, source, dto);

    if (actor) {
      await this.auditTrailService.createAuditEvent(companyId, actor.sub, {
        eventType: AuditEventType.GHG_CALCULATION,
        action: AuditAction.VALIDATE,
        entityType: 'EmissionCalculation',
        entityId: source.id,
        metadata: {
          sourceId: source.id,
          scope: source.scope,
          co2e: calculation.co2e,
          methodology: calculation.methodology,
        },
      });
    }

    return {
      source,
      co2e: calculation.co2e,
      emissionFactor: calculation.emissionFactor,
      factor: calculation.factor,
      methodology: calculation.methodology,
      details: calculation.details,
      frameworkValidation: calculation.frameworkValidation,
    };
  }

  async listFactors(query: EmissionFactorsQueryDto) {
    return this.emissionFactorsService.listFactors(query);
  }

  async getInventory(companyId: string, query: InventoryQueryDto) {
    const frameworkValidation = await this.buildFrameworkValidation(companyId);
    return this.inventoryService.getInventory(
      companyId,
      query,
      frameworkValidation,
    );
  }

  async getAnnualInventory(companyId: string, year: number) {
    const frameworkValidation = await this.buildFrameworkValidation(companyId);
    return this.inventoryService.getAnnualInventory(
      companyId,
      year,
      frameworkValidation,
    );
  }

  async getTrends(companyId: string, query: TrendsQueryDto) {
    return {
      companyId,
      trends: await this.inventoryService.getTrends(companyId, query),
    };
  }

  async verifyOffsetsForCompliance(
    companyId: string,
    tokenIds: string[],
  ): Promise<{
    valid: boolean;
    results: Array<{ tokenId: string; valid: boolean; message: string }>;
    totalValid: number;
    totalTokens: number;
  }> {
    const verification =
      await this.retirementVerificationService.verifyRetirements(companyId, {
        tokens: tokenIds.map((id) => ({ tokenId: id })),
        framework: ComplianceFramework.GHG,
      });

    const results = verification.results.map((r) => ({
      tokenId: r.tokenId,
      valid: r.status === OffsetClaimStatus.VERIFIED,
      message: r.message,
    }));

    const totalValid = results.filter((r) => r.valid).length;

    this.logger.log(
      `GHG offset verification: ${totalValid}/${tokenIds.length} tokens valid for company ${companyId}`,
    );

    return {
      valid: totalValid === tokenIds.length,
      results,
      totalValid,
      totalTokens: tokenIds.length,
    };
  }

  private async getSourceOrThrow(companyId: string, sourceId: string) {
    const source = await this.prisma.emissionSource.findFirst({
      where: {
        id: sourceId,
        companyId,
      },
    });

    if (!source) {
      throw new NotFoundException('Emission source not found');
    }

    if (!source.isActive) {
      throw new BadRequestException('Emission source is inactive');
    }

    return source;
  }

  private async calculateForSource(
    companyId: string,
    source: {
      id: string;
      scope: number;
      category: string;
      activityType: string;
      unit: string;
    },
    dto: RecordEmissionDto,
  ) {
    const period = this.parsePeriod(dto.periodStart, dto.periodEnd);
    const factor = dto.emissionFactorOverride
      ? {
          id: 'override',
          source: dto.factorSource?.toUpperCase() || 'MANUAL_OVERRIDE',
          activityType: source.activityType,
          unit: dto.unit || source.unit,
          co2ePerUnit: dto.emissionFactorOverride,
          validFrom: period.end,
          validTo: null,
          region: (dto.region || 'GLOBAL').toUpperCase(),
          methodology: dto.methodology || null,
          isActive: true,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      : await this.emissionFactorsService.resolveFactor({
          activityType: source.activityType,
          unit: dto.unit || source.unit,
          region: dto.region,
          asOfDate: period.end,
          preferredSource: dto.factorSource,
        });

    const emissionFactor = factor.co2ePerUnit;
    let calculation:
      | ReturnType<Scope1Service['calculate']>
      | ReturnType<Scope2Service['calculate']>
      | ReturnType<Scope3Service['calculate']>;

    if (source.scope === 1) {
      calculation = this.scope1Service.calculate({
        activityValue: dto.activityValue,
        emissionFactor,
      });
    } else if (source.scope === 2) {
      calculation = this.scope2Service.calculate({
        activityValue: dto.activityValue,
        emissionFactor,
        methodology: dto.methodology,
        renewableEnergyPercentage: dto.renewableEnergyPercentage,
        transmissionLossFactor: dto.transmissionLossFactor,
      });
    } else {
      calculation = this.scope3Service.calculate({
        activityValue: dto.activityValue,
        emissionFactor,
        category: source.category,
      });
    }

    return {
      ...calculation,
      factor,
      emissionFactor,
      frameworkValidation: await this.buildFrameworkValidation(companyId),
    };
  }

  private async buildFrameworkValidation(
    companyId: string,
  ): Promise<FrameworkValidationSummary> {
    const [framework, compliance, sources] = await Promise.all([
      this.prisma.framework.findFirst({
        where: { code: { in: ['GHG', 'GHG_PROTOCOL'] } },
      }),
      this.prisma.compliance.findFirst({
        where: {
          companyId,
          framework: { in: ['GHG', 'GHG_PROTOCOL'] },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.emissionSource.findMany({
        where: { companyId, isActive: true },
        select: { scope: true },
      }),
    ]);

    const coveredScopes = new Set<number>(
      sources.map((source) => source.scope),
    );
    const requirements = Array.isArray(framework?.requirements)
      ? framework!.requirements.map((requirement: any) => ({
          id: String(requirement.id),
          name: String(requirement.name || requirement.id),
          description: requirement.description
            ? String(requirement.description)
            : undefined,
          satisfied: this.isRequirementSatisfied(
            String(requirement.id),
            coveredScopes,
          ),
        }))
      : [];

    return {
      frameworkCode: framework?.code || null,
      complianceStatus: compliance?.status || null,
      requirements,
    };
  }

  private isRequirementSatisfied(
    requirementId: string,
    coveredScopes: Set<number>,
  ) {
    if (requirementId.includes('scope-1')) {
      return coveredScopes.has(1);
    }

    if (requirementId.includes('scope-2')) {
      return coveredScopes.has(2);
    }

    if (requirementId.includes('scope-3')) {
      return coveredScopes.has(3);
    }

    if (requirementId.includes('inventory')) {
      return coveredScopes.size > 0;
    }

    return false;
  }

  private parsePeriod(periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid periodStart or periodEnd');
    }

    if (end <= start) {
      throw new BadRequestException('periodEnd must be after periodStart');
    }

    return { start, end };
  }

  private assertCompanyId(companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }
  }

  private assertScope(scope: number) {
    if (![1, 2, 3].includes(scope)) {
      throw new BadRequestException('scope must be 1, 2, or 3');
    }
  }
}
