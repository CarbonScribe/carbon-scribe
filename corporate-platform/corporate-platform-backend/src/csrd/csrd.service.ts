import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { MaterialityAssessmentService } from './services/materiality-assessment.service';
import { EsrsDisclosureService } from './services/esrs-disclosure.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { AssuranceService } from './services/assurance.service';
import { SecurityService } from '../security/security.service';
import { RetirementVerificationService } from '../compliance/services/retirement-verification.service';
import {
  ComplianceFramework,
  OffsetClaimStatus,
} from '../compliance/dto/retirement-verification.dto';
import { CreateMaterialityAssessmentDto } from './dto/assessment.dto';
import {
  DisclosureQueryDto,
  RecordDisclosureDto,
  UpdateAssuranceDto,
} from './dto/disclosure-query.dto';
import { EsrsStandard } from './interfaces/disclosure.interface';

const ALL_ESRS_STANDARDS = Object.values(EsrsStandard);

@Injectable()
export class CsrdService {
  private readonly logger = new Logger(CsrdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materialityService: MaterialityAssessmentService,
    private readonly disclosureService: EsrsDisclosureService,
    private readonly reportService: ReportGeneratorService,
    private readonly assuranceService: AssuranceService,
    private readonly securityService: SecurityService,
    private readonly retirementVerificationService: RetirementVerificationService,
  ) {}

  async assessMateriality(
    companyId: string,
    dto: CreateMaterialityAssessmentDto,
    userId = 'system',
  ) {
    const assessment = await this.materialityService.createAssessment(
      companyId,
      dto,
      userId,
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

  async recordDisclosure(
    companyId: string,
    dto: RecordDisclosureDto,
    userId = 'system',
  ) {
    const disclosure = await this.disclosureService.record(
      companyId,
      dto,
      userId,
    );

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

  async getRequirements(standard?: string) {
    return this.disclosureService.getRequirements(standard);
  }

  async generateReport(companyId: string, year: number, userId = 'system') {
    const report = await this.reportService.generate(companyId, year, userId);

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

  async updateAssurance(
    companyId: string,
    disclosureId: string,
    dto: UpdateAssuranceDto,
    userId = 'system',
  ) {
    return this.assuranceService.updateAssurance(
      companyId,
      disclosureId,
      dto.assuranceLevel,
      dto.assuredBy,
      userId,
    );
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
    const [completedAssessments, disclosuresByStandard, submittedReports] =
      await Promise.all([
        this.prisma.materialityAssessment.count({
          where: { companyId, status: 'COMPLETED' },
        }),
        this.prisma.esrsDisclosure.groupBy({
          by: ['standard'],
          where: { companyId },
          _count: true,
        }),
        this.prisma.csrdReport.count({
          where: { companyId, status: 'SUBMITTED' },
        }),
      ]);

    const coveredStandards = new Set(
      disclosuresByStandard.map((d) => d.standard),
    );
    const missingStandards = ALL_ESRS_STANDARDS.filter(
      (s) => !coveredStandards.has(s),
    );
    const totalDisclosures = disclosuresByStandard.reduce(
      (sum, d) => sum + d._count,
      0,
    );

    // Score: 30 pts materiality, 50 pts disclosure coverage, 20 pts submissions
    const disclosureCoverage =
      coveredStandards.size / ALL_ESRS_STANDARDS.length;
    const overallScore = Math.round(
      (completedAssessments > 0 ? 30 : 0) +
        disclosureCoverage * 50 +
        (submittedReports > 0 ? 20 : 0),
    );

    return {
      companyId,
      overallScore,
      milestones: {
        doubleMaterialityComplete: completedAssessments > 0,
        esrsDisclosuresStarted: totalDisclosures > 0,
        assuranceReady: totalDisclosures >= 50,
        reportingSubmissions: submittedReports,
      },
      coverage: {
        standardsCovered: coveredStandards.size,
        totalStandards: ALL_ESRS_STANDARDS.length,
        totalDisclosures,
      },
      missingStandards,
    };
  }
}
