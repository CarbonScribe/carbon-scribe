import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { MaterialityAssessmentService } from './services/materiality-assessment.service';
import { EsrsDisclosureService } from './services/esrs-disclosure.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { CreateMaterialityAssessmentDto } from './dto/assessment.dto';
import {
  DisclosureQueryDto,
  RecordDisclosureDto,
} from './dto/disclosure-query.dto';
import { SecurityService } from '../security/security.service';

@Injectable()
export class CsrdService {
  private readonly logger = new Logger(CsrdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialityService: MaterialityAssessmentService,
    private readonly disclosureService: EsrsDisclosureService,
    private readonly reportService: ReportGeneratorService,
    private readonly securityService: SecurityService,
  ) {}

  async assessMateriality(
    companyId: string,
    dto: CreateMaterialityAssessmentDto,
  ) {
    const assessment = await this.materialityService.createAssessment(
      companyId,
      dto,
    );

    await this.securityService.logEvent({
      eventType: 'csrd.materiality.assessed' as any,
      companyId,
      details: { assessmentId: assessment.id, year: dto.assessmentYear },
      status: 'success',
    });

    return assessment;
  }

  async getCurrentMateriality(companyId: string) {
    return this.materialityService.getCurrent(companyId);
  }

  async recordDisclosure(companyId: string, dto: RecordDisclosureDto) {
    const disclosure = await this.disclosureService.record(companyId, dto);

    await this.securityService.logEvent({
      eventType: 'csrd.disclosure.recorded' as any,
      companyId,
      details: { disclosureId: disclosure.id, standard: dto.standard },
      status: 'success',
    });

    return disclosure;
  }

  async listDisclosures(companyId: string, query: DisclosureQueryDto) {
    return this.disclosureService.list(companyId, query);
  }

  async getRequirements(standard: string) {
    return this.disclosureService.getRequirements(standard);
  }

  async generateReport(companyId: string, year: number) {
    const report = await this.reportService.generate(companyId, year);

    await this.securityService.logEvent({
      eventType: 'csrd.report.generated' as any,
      companyId,
      details: { reportId: report.id, year },
      status: 'success',
    });

    return report;
  }

  async listReports(companyId: string) {
    return this.prisma.csrdReport.findMany({
      where: { companyId },
      orderBy: { reportingYear: 'desc' },
    });
  }

  async getReadinessScorecard(companyId: string) {
    // Basic readiness scorecard logic
    const assessments = await this.prisma.materialityAssessment.count({
      where: { companyId, status: 'COMPLETED' },
    });
    const disclosures = await this.prisma.esrsDisclosure.count({
      where: { companyId },
    });
    const reports = await this.prisma.csrdReport.count({
      where: { companyId, status: 'SUBMITTED' },
    });

    return {
      companyId,
      overallScore: assessments > 0 ? (disclosures > 10 ? 100 : 50) : 10,
      milestones: {
        doubleMaterialityComplete: assessments > 0,
        esrsDisclosuresStarted: disclosures > 0,
        assuranceReady: disclosures > 50,
        reportingSubmissions: reports,
      },
      missingStandards: ['ESRS E1', 'ESRS S1'], // Placeholder
    };
  }
}
