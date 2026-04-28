import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditTrailService } from '../../audit-trail/audit-trail.service';
import { GhgProtocolService } from '../../ghg-protocol/ghg-protocol.service';
import {
  AuditAction,
  AuditEventType,
} from '../../audit-trail/interfaces/audit-event.interface';
import {
  CsrdReportSection,
  CsrdReportStructure,
} from '../interfaces/csrd-report.interface';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
    private readonly ghgProtocolService: GhgProtocolService,
  ) {}

  async generate(companyId: string, year: number, userId = 'system') {
    const [disclosures, materiality, ghgInventory] = await Promise.all([
      this.prisma.esrsDisclosure.findMany({
        where: { companyId, reportingPeriod: String(year) },
        orderBy: [{ standard: 'asc' }, { disclosureRequirement: 'asc' }],
      }),
      this.prisma.materialityAssessment.findFirst({
        where: { companyId, assessmentYear: year, status: 'COMPLETED' },
        orderBy: { assessmentYear: 'desc' },
      }),
      this.fetchGhgInventory(companyId, year),
    ]);

    const sections = this.buildReportSections(disclosures, ghgInventory);
    const standardsCovered = [
      ...new Set(disclosures.map((d) => d.standard)),
    ].sort();

    const reportStructure: CsrdReportStructure = {
      companyId,
      reportingYear: year,
      sections,
      materialityMatrix: (materiality?.doubleMateriality as any) ?? null,
      ghgInventory,
      metadata: {
        generatedAt: new Date(),
        format: 'XHTML/iXBRL',
        isExternalAssured: false,
        totalDisclosures: disclosures.length,
        standardsCovered,
      },
    };

    const report = await this.prisma.csrdReport.create({
      data: {
        companyId,
        reportingYear: year,
        status: 'REVIEW',
        metadata: reportStructure as any,
        reportUrl: null,
      },
    });

    await this.auditTrailService.createAuditEvent(companyId, userId, {
      eventType: AuditEventType.CSRD_DISCLOSURE,
      action: AuditAction.CREATE,
      entityType: 'CsrdReport',
      entityId: report.id,
      newState: report,
      metadata: {
        reportingYear: year,
        totalDisclosures: disclosures.length,
        standardsCovered,
      },
    });

    return report;
  }

  private buildReportSections(
    disclosures: any[],
    ghgInventory: any,
  ): CsrdReportSection[] {
    const byKey = new Map<string, CsrdReportSection>();

    for (const d of disclosures) {
      const key = `${d.standard}::${d.disclosureRequirement}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          standard: d.standard,
          disclosureRequirement: d.disclosureRequirement,
          dataPoints: [],
        });
      }
      byKey.get(key)!.dataPoints.push({
        key: d.dataPoint,
        value: d.value,
        assuranceLevel: d.assuranceLevel ?? undefined,
      });
    }

    if (ghgInventory) {
      const e1Key = 'ESRS E1::E1-6';
      if (!byKey.has(e1Key)) {
        byKey.set(e1Key, {
          standard: 'ESRS E1',
          disclosureRequirement: 'E1-6',
          dataPoints: [],
        });
      }
      const e1 = byKey.get(e1Key)!;
      e1.dataPoints.push(
        { key: 'scope1_tco2e', value: ghgInventory.scope1Total },
        { key: 'scope2_tco2e', value: ghgInventory.scope2Total },
        { key: 'scope3_tco2e', value: ghgInventory.scope3Total },
        { key: 'grand_total_tco2e', value: ghgInventory.grandTotal },
      );
    }

    return Array.from(byKey.values()).sort((a, b) =>
      a.standard.localeCompare(b.standard),
    );
  }

  private async fetchGhgInventory(companyId: string, year: number) {
    try {
      return await this.ghgProtocolService.getAnnualInventory(companyId, year);
    } catch {
      this.logger.warn(
        `GHG inventory unavailable for ${companyId} year ${year}`,
      );
      return null;
    }
  }
}
