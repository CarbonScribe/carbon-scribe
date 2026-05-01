import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditTrailService } from '../../audit-trail/audit-trail.service';
import { GhgProtocolService } from '../../ghg-protocol/ghg-protocol.service';
import {
  AuditAction,
  AuditEventType,
} from '../../audit-trail/interfaces/audit-event.interface';
import {
  DisclosureQueryDto,
  RecordDisclosureDto,
} from '../dto/disclosure-query.dto';
import {
  DisclosureRequirement,
  EsrsStandard,
} from '../interfaces/disclosure.interface';

const BUILT_IN_REQUIREMENTS: DisclosureRequirement[] = [
  {
    id: 'E1-1',
    standard: EsrsStandard.E1,
    requirement: 'E1-1',
    description: 'Transition plan for climate change mitigation',
    dataPoints: ['target_year', 'baseline_year', 'reduction_target_pct'],
  },
  {
    id: 'E1-6',
    standard: EsrsStandard.E1,
    requirement: 'E1-6',
    description: 'Gross Scopes 1, 2, 3 and total GHG emissions',
    dataPoints: ['scope1_tco2e', 'scope2_tco2e', 'scope3_tco2e'],
  },
  {
    id: 'E2-4',
    standard: EsrsStandard.E2,
    requirement: 'E2-4',
    description: 'Pollution of air, water and soil',
    dataPoints: ['air_pollutants', 'water_pollutants'],
  },
  {
    id: 'E3-4',
    standard: EsrsStandard.E3,
    requirement: 'E3-4',
    description: 'Water consumption',
    dataPoints: ['total_water_consumption_m3', 'water_recycled_pct'],
  },
  {
    id: 'E4-5',
    standard: EsrsStandard.E4,
    requirement: 'E4-5',
    description: 'Impact metrics related to biodiversity and ecosystems',
    dataPoints: ['land_use_hectares', 'protected_area_impact'],
  },
  {
    id: 'E5-5',
    standard: EsrsStandard.E5,
    requirement: 'E5-5',
    description: 'Resource inflows and outflows',
    dataPoints: ['waste_generated_tonnes', 'recycled_pct'],
  },
  {
    id: 'S1-6',
    standard: EsrsStandard.S1,
    requirement: 'S1-6',
    description: 'Characteristics of own workforce',
    dataPoints: ['headcount', 'female_pct', 'part_time_pct'],
  },
  {
    id: 'S2-4',
    standard: EsrsStandard.S2,
    requirement: 'S2-4',
    description:
      'Impacts, risks and opportunities related to value chain workers',
    dataPoints: ['supplier_audits', 'ncr_count'],
  },
  {
    id: 'S3-4',
    standard: EsrsStandard.S3,
    requirement: 'S3-4',
    description:
      'Impacts, risks and opportunities related to affected communities',
    dataPoints: ['community_engagement_initiatives'],
  },
  {
    id: 'S4-4',
    standard: EsrsStandard.S4,
    requirement: 'S4-4',
    description:
      'Impacts, risks and opportunities related to consumers and end-users',
    dataPoints: ['product_safety_incidents'],
  },
  {
    id: 'G1-1',
    standard: EsrsStandard.G1,
    requirement: 'G1-1',
    description: 'Business conduct policies and approach',
    dataPoints: ['anti_bribery_policy', 'whistleblower_channel'],
  },
];

@Injectable()
export class EsrsDisclosureService {
  private readonly logger = new Logger(EsrsDisclosureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
    private readonly ghgProtocolService: GhgProtocolService,
  ) {}

  async record(companyId: string, dto: RecordDisclosureDto, userId = 'system') {
    const disclosure = await this.prisma.esrsDisclosure.create({
      data: {
        companyId,
        reportingPeriod: dto.reportingPeriod,
        standard: dto.standard,
        disclosureRequirement: dto.disclosureRequirement,
        dataPoint: dto.dataPoint,
        value: dto.value as any,
        assuranceLevel: dto.assuranceLevel,
      },
    });

    await this.auditTrailService.createAuditEvent(companyId, userId, {
      eventType: AuditEventType.CSRD_DISCLOSURE,
      action: AuditAction.CREATE,
      entityType: 'EsrsDisclosure',
      entityId: disclosure.id,
      newState: disclosure,
      metadata: {
        standard: dto.standard,
        disclosureRequirement: dto.disclosureRequirement,
        reportingPeriod: dto.reportingPeriod,
      },
    });

    return disclosure;
  }

  async list(companyId: string, query: DisclosureQueryDto) {
    const where: Record<string, unknown> = { companyId };
    if (query.reportingPeriod) where.reportingPeriod = query.reportingPeriod;
    if (query.standard) where.standard = query.standard;

    return this.prisma.esrsDisclosure.findMany({
      where,
      orderBy: [{ standard: 'asc' }, { disclosureRequirement: 'asc' }],
    });
  }

  async getRequirements(standard?: string): Promise<DisclosureRequirement[]> {
    const framework = await this.prisma.framework.findFirst({
      where: { code: { in: ['CSRD', 'ESRS'] } },
    });

    if (framework) {
      const requirements = (framework.requirements as any[]) || [];
      const filtered = standard
        ? requirements.filter((r) => r.standard === standard)
        : requirements;

      if (filtered.length > 0) return filtered;
    }

    return standard
      ? BUILT_IN_REQUIREMENTS.filter((r) => r.standard === standard)
      : BUILT_IN_REQUIREMENTS;
  }

  async getClimateDisclosuresForEsrsE1(companyId: string, year: number) {
    try {
      const inventory = await this.ghgProtocolService.getAnnualInventory(
        companyId,
        year,
      );
      return {
        standard: EsrsStandard.E1,
        disclosureRequirement: 'E1-6',
        ghgInventory: {
          scope1: (inventory as any).scope1Total,
          scope2: (inventory as any).scope2Total,
          scope3: (inventory as any).scope3Total,
          total: (inventory as any).grandTotal,
          unit: 'tCO2e',
          reportingYear: year,
        },
      };
    } catch (error) {
      this.logger.warn(
        `GHG inventory not available for company ${companyId} year ${year}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
