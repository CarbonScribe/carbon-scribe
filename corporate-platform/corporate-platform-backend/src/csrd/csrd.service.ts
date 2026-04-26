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
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';

@Injectable()
export class CsrdService {
  private readonly logger = new Logger(CsrdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialityService: MaterialityAssessmentService,
    private readonly disclosureService: EsrsDisclosureService,
    private readonly reportService: ReportGeneratorService,
    private readonly securityService: SecurityService,
    private readonly retirementVerificationService: RetirementVerificationService,
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
        framework: ComplianceFramework.CSRD,
      });

    const results = verification.results.map((r) => ({
      tokenId: r.tokenId,
      valid: r.status === OffsetClaimStatus.VERIFIED,
      message: r.message,
    }));

    const totalValid = results.filter((r) => r.valid).length;

    this.logger.log(
      `CSRD offset verification: ${totalValid}/${tokenIds.length} tokens valid for company ${companyId}`,
    );

    return {
      valid: totalValid === tokenIds.length,
      results,
      totalValid,
      totalTokens: tokenIds.length,
    };
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
