import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { SecurityEvents } from '../security/constants/security-events.constants';
import {
  CheckComplianceDto,
  ComplianceFramework,
  EntityType,
} from './dto/check-compliance.dto';
import {
  ComplianceCheckResultDto,
  ComplianceReportDto,
  ComplianceIssue,
  ComplianceRequirement,
  FrameworkReportDetail,
} from './dto/compliance-report.dto';
import {
  ComplianceStatus,
  ComplianceStatusDto,
} from './dto/compliance-status.dto';
import {
  IComplianceValidator,
  ValidationResult,
} from './interfaces/compliance-validator.interface';
import { RetirementVerificationService } from './services/retirement-verification.service';
import {
  VerifyRetirementDto,
  RetirementVerificationResponse,
  RetirementStatusResult,
} from './dto/retirement-verification.dto';

@Injectable()
export class ComplianceService implements IComplianceValidator {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private prisma: PrismaService,
    private securityService: SecurityService,
    private retirementVerificationService: RetirementVerificationService,
  ) {}

  /**
   * Run compliance checks on an entity
   */
  async checkCompliance(
    companyId: string,
    dto: CheckComplianceDto,
  ): Promise<ComplianceCheckResultDto> {
    const { framework, entityType, entityId, metadata } = dto;

    // Validate entity exists based on type
    await this.validateEntity(entityType, entityId, companyId);

    // Run framework-specific validation
    const result = await this.runFrameworkValidation(
      framework,
      entityId,
      entityType,
      metadata,
    );

    // Store compliance check result in database
    await this.storeComplianceCheck(companyId, result);

    // Log the compliance check
    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      resource: `/api/v1/compliance/check`,
      method: 'POST',
      status: 'success',
      statusCode: 200,
      details: {
        framework,
        entityType,
        entityId,
        checkStatus: result.status,
      },
    });

    return this.mapToCheckResultDto(result);
  }

  /**
   * Get compliance status for an entity
   */
  async getComplianceStatus(
    companyId: string,
    entityId: string,
  ): Promise<ComplianceStatusDto[]> {
    // Verify entity belongs to company
    const entityExists = await this.prisma.compliance.findFirst({
      where: {
        id: entityId,
      },
    });

    if (!entityExists) {
      throw new NotFoundException(
        `Compliance record not found for entity ${entityId}`,
      );
    }

    // Fetch all compliance records for the entity
    const statuses = await this.prisma.compliance.findMany({
      where: {
        companyId,
      },
    });

    return statuses.map((s) => ({
      entityId: s.id,
      framework: s.framework,
      status: this.normalizeStatus(s.status),
      reason: s.requirements ? JSON.stringify(s.requirements) : undefined,
      dueDate: s.dueDate,
      completedAt: s.completedAt,
    }));
  }

  /**
   * Generate or retrieve compliance report for an entity
   */
  async getComplianceReport(
    companyId: string,
    entityId: string,
  ): Promise<ComplianceReportDto> {
    // Fetch entity's compliance records
    const complianceRecords = await this.prisma.compliance.findMany({
      where: {
        companyId,
      },
    });

    if (complianceRecords.length === 0) {
      throw new NotFoundException(
        `No compliance records found for company ${companyId}`,
      );
    }

    // Build comprehensive report
    const report = this.buildComplianceReport(entityId, complianceRecords);

    // Log report generation
    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      resource: `/api/v1/compliance/report/${entityId}`,
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return report;
  }

  async verifyRetirementsForCompliance(
    companyId: string,
    dto: VerifyRetirementDto,
  ): Promise<RetirementVerificationResponse> {
    this.logger.log(
      `Verifying retirements for company ${companyId}, framework: ${dto.framework}`,
    );
    return this.retirementVerificationService.verifyRetirements(companyId, dto);
  }

  async getRetirementStatus(
    companyId: string,
    tokenId: string,
    framework?: ComplianceFramework,
  ): Promise<RetirementStatusResult> {
    return this.retirementVerificationService.getRetirementStatus(
      companyId,
      tokenId,
      framework,
    );
  }

  async validateTokensForCompliance(
    companyId: string,
    tokenIds: string[],
    framework: ComplianceFramework,
    requiredAmounts?: Record<string, number>,
  ): Promise<{
    valid: boolean;
    results: Array<{ tokenId: string; valid: boolean; message: string }>;
  }> {
    const results = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const verification =
          await this.retirementVerificationService.verifyTokenForCompliance(
            companyId,
            tokenId,
            framework,
            requiredAmounts?.[tokenId],
          );
        return {
          tokenId,
          valid: verification.valid,
          message: verification.message,
        };
      }),
    );

    const allValid = results.every((r) => r.valid);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      details: {
        framework,
        totalTokens: tokenIds.length,
        validTokens: results.filter((r) => r.valid).length,
      },
      status: allValid ? 'success' : 'warning',
    });

    return {
      valid: allValid,
      results,
    };
  }

  async checkDoubleClaimRisk(
    companyId: string,
    tokenIds: string[],
    framework: ComplianceFramework,
  ): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    atRiskTokens: string[];
    message: string;
  }> {
    const results = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const status =
          await this.retirementVerificationService.getRetirementStatus(
            companyId,
            tokenId,
            framework,
          );
        return status.claims.length > 0 ? tokenId : null;
      }),
    );

    const atRiskTokens = results.filter((id) => id !== null) as string[];
    const riskPercentage = (atRiskTokens.length / tokenIds.length) * 100;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    let message: string;

    if (riskPercentage === 0) {
      riskLevel = 'LOW';
      message = 'No double-claim risk detected. All tokens are available.';
    } else if (riskPercentage < 50) {
      riskLevel = 'MEDIUM';
      message = `Moderate double-claim risk. ${atRiskTokens.length} tokens may have been claimed previously.`;
    } else {
      riskLevel = 'HIGH';
      message = `High double-claim risk. ${atRiskTokens.length} tokens have been claimed. Consider using different tokens.`;
    }

    return {
      riskLevel,
      atRiskTokens,
      message,
    };
  }

  async getVerificationHistory(
    companyId: string,
    options?: {
      tokenId?: string;
      framework?: ComplianceFramework;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.retirementVerificationService.getVerificationHistory(
      companyId,
      options,
    );
  }

  /**
   * Compliance framework validators
   */
  async validateCBam(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.CBAM,
      entityId,
      EntityType.CREDIT,
      metadata,
    );
  }

  async validateCorsia(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.CORSIA,
      entityId,
      EntityType.TRANSACTION,
      metadata,
    );
  }

  async validateArticle6(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.ARTICLE_6,
      entityId,
      EntityType.PROJECT,
      metadata,
    );
  }

  async validateSBTi(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.SBTi,
      entityId,
      EntityType.COMPANY,
      metadata,
    );
  }

  async validateCDP(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.CDP,
      entityId,
      EntityType.COMPANY,
      metadata,
    );
  }

  async validateGRI(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.GRI,
      entityId,
      EntityType.COMPANY,
      metadata,
    );
  }

  async validateCSRD(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.CSRD,
      entityId,
      EntityType.COMPANY,
      metadata,
    );
  }

  async validateTCFD(
    entityId: string,
    metadata?: any,
  ): Promise<ValidationResult> {
    return this.buildValidationResult(
      ComplianceFramework.TCFD,
      entityId,
      EntityType.COMPANY,
      metadata,
    );
  }

  // ================== Private Helper Methods ==================

  private async validateEntity(
    entityType: EntityType,
    entityId: string,
    companyId: string,
  ): Promise<void> {
    switch (entityType) {
      case EntityType.CREDIT:
        const credit = await this.prisma.credit.findFirst({
          where: { id: entityId, companyId },
        });
        if (!credit) {
          throw new BadRequestException(
            `Credit with ID ${entityId} not found for this company`,
          );
        }
        break;
      case EntityType.PROJECT:
        const project = await this.prisma.project.findFirst({
          where: { id: entityId, companyId },
        });
        if (!project) {
          throw new BadRequestException(
            `Project with ID ${entityId} not found for this company`,
          );
        }
        break;
      case EntityType.COMPANY:
        const company = await this.prisma.company.findUnique({
          where: { id: companyId },
        });
        if (!company) {
          throw new BadRequestException(`Company ${companyId} not found`);
        }
        break;
      default:
        break;
    }
  }

  private async runFrameworkValidation(
    framework: ComplianceFramework,
    entityId: string,
    entityType: EntityType,
    metadata?: any,
  ): Promise<ValidationResult> {
    switch (framework) {
      case ComplianceFramework.CBAM:
        return this.validateCBam(entityId, metadata);
      case ComplianceFramework.CORSIA:
        return this.validateCorsia(entityId, metadata);
      case ComplianceFramework.ARTICLE_6:
        return this.validateArticle6(entityId, metadata);
      case ComplianceFramework.SBTi:
        return this.validateSBTi(entityId, metadata);
      case ComplianceFramework.CDP:
        return this.validateCDP(entityId, metadata);
      case ComplianceFramework.GRI:
        return this.validateGRI(entityId, metadata);
      case ComplianceFramework.CSRD:
        return this.validateCSRD(entityId, metadata);
      case ComplianceFramework.TCFD:
        return this.validateTCFD(entityId, metadata);
      default:
        throw new BadRequestException(`Unknown framework: ${framework}`);
    }
  }

  private async storeComplianceCheck(
    companyId: string,
    result: ValidationResult,
  ): Promise<void> {
    await this.prisma.compliance.create({
      data: {
        companyId,
        framework: result.framework,
        status: result.status,
        requirements: result.requirements as unknown as Prisma.InputJsonValue,
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      },
    });
  }

  private buildValidationResult(
    framework: ComplianceFramework,
    entityId: string,
    entityType: EntityType,
    metadata?: any,
  ): ValidationResult {
    // Framework-specific validation logic (simplified for demo)
    const issues: ComplianceIssue[] = this.generateFrameworkIssues(
      framework,
      metadata,
    );
    const requirements: ComplianceRequirement[] =
      this.generateFrameworkRequirements(framework);
    const status = issues.some((i) => i.severity === 'error')
      ? ComplianceStatus.NON_COMPLIANT
      : issues.some((i) => i.severity === 'warning')
        ? ComplianceStatus.IN_PROGRESS
        : ComplianceStatus.COMPLIANT;

    return {
      framework,
      entityId,
      entityType,
      status,
      issues,
      requirements,
      recommendations: this.generateRecommendations(issues),
      timestamp: new Date(),
    };
  }

  private generateFrameworkIssues(
    framework: ComplianceFramework,
    _metadata?: any,
  ): ComplianceIssue[] {
    // Simplified issue generation based on framework
    const baseIssues: ComplianceIssue[] = [
      {
        code: `${framework}-001`,
        severity: 'warning',
        message: `Incomplete documentation for ${framework} requirements`,
        affectedArea: 'Documentation',
        suggestedAction: `Submit all required ${framework} documentation`,
      },
    ];

    // Add framework-specific issues
    if (framework === ComplianceFramework.CBAM) {
      baseIssues.push({
        code: 'CBAM-002',
        severity: 'info',
        message: 'Carbon price transition period applies',
        affectedArea: 'Pricing',
      });
    }

    if (framework === ComplianceFramework.CORSIA) {
      baseIssues.push({
        code: 'CORSIA-002',
        severity: 'info',
        message: 'Baseline year compliance check pending',
        affectedArea: 'Baseline',
      });
    }

    return baseIssues;
  }

  private generateFrameworkRequirements(
    framework: ComplianceFramework,
  ): ComplianceRequirement[] {
    const requirementMap = {
      [ComplianceFramework.CBAM]: [
        {
          id: 'cbam-1',
          name: 'Carbon Footprint Calculation',
          status: 'met' as const,
          description:
            'Calculate and report embedded emissions in imported goods',
          priority: 'high' as const,
        },
        {
          id: 'cbam-2',
          name: 'Declaration Submission',
          status: 'pending' as const,
          description: 'Submit CBAM declarations to customs authorities',
          priority: 'high' as const,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
      [ComplianceFramework.CORSIA]: [
        {
          id: 'corsia-1',
          name: 'Baseline Year Establishment',
          status: 'met' as const,
          description: 'Establish and document baseline year for CORSIA',
          priority: 'high' as const,
        },
        {
          id: 'corsia-2',
          name: 'Monitoring Plan',
          status: 'unmet' as const,
          description: 'Develop comprehensive flight emissions monitoring plan',
          priority: 'high' as const,
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      ],
      [ComplianceFramework.ARTICLE_6]: [
        {
          id: 'article6-1',
          name: 'Project Validation',
          status: 'pending' as const,
          description: 'Submit project for independent validation',
          priority: 'high' as const,
        },
      ],
      [ComplianceFramework.SBTi]: [
        {
          id: 'sbti-1',
          name: 'Target Setting',
          status: 'unmet' as const,
          description: 'Set science-based targets for emissions reduction',
          priority: 'medium' as const,
        },
      ],
      [ComplianceFramework.CDP]: [
        {
          id: 'cdp-1',
          name: 'Climate Change Disclosure',
          status: 'unmet' as const,
          description: 'Complete CDP climate change questionnaire',
          priority: 'medium' as const,
        },
      ],
      [ComplianceFramework.GRI]: [
        {
          id: 'gri-1',
          name: 'Sustainability Reporting',
          status: 'unmet' as const,
          description: 'Report according to GRI Standards',
          priority: 'medium' as const,
        },
      ],
      [ComplianceFramework.CSRD]: [
        {
          id: 'csrd-1',
          name: 'Double Materiality Assessment',
          status: 'unmet' as const,
          description: 'Conduct double materiality assessment',
          priority: 'high' as const,
        },
      ],
      [ComplianceFramework.TCFD]: [
        {
          id: 'tcfd-1',
          name: 'Climate Risk Assessment',
          status: 'unmet' as const,
          description: 'Assess financial impact of climate risks',
          priority: 'medium' as const,
        },
      ],
    };

    return requirementMap[framework] || [];
  }

  private generateRecommendations(issues: ComplianceIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((i) => i.severity === 'error')) {
      recommendations.push('Address critical compliance issues immediately');
    }

    if (issues.some((i) => i.severity === 'warning')) {
      recommendations.push(
        'Complete outstanding documentation and submissions within 30 days',
      );
    }

    recommendations.push('Schedule quarterly compliance reviews');
    recommendations.push('Ensure team training on regulatory requirements');

    return recommendations;
  }

  private mapToCheckResultDto(
    result: ValidationResult,
  ): ComplianceCheckResultDto {
    return {
      framework: result.framework,
      entityId: result.entityId,
      entityType: result.entityType,
      status: result.status,
      timestamp: result.timestamp,
      issues: result.issues,
      requirements: result.requirements,
      recommendations: result.recommendations,
    };
  }

  private normalizeStatus(status: string): ComplianceStatus {
    const statusMap = {
      compliant: ComplianceStatus.COMPLIANT,
      in_progress: ComplianceStatus.IN_PROGRESS,
      not_started: ComplianceStatus.NOT_STARTED,
      non_compliant: ComplianceStatus.NON_COMPLIANT,
      pending_review: ComplianceStatus.PENDING_REVIEW,
    };
    return statusMap[status] || ComplianceStatus.NOT_STARTED;
  }

  private buildComplianceReport(
    entityId: string,
    records: any[],
  ): ComplianceReportDto {
    const frameworks = [
      ...new Set(records.map((r) => r.framework as ComplianceFramework)),
    ];
    const frameworkReports: FrameworkReportDetail[] = frameworks.map((fw) => {
      const record = records.find((r) => r.framework === fw);
      return {
        framework: fw,
        status: this.normalizeStatus(record?.status || 'not_started'),
        compliance: this.calculateCompliancePercentage(record),
        requirements: this.generateFrameworkRequirements(fw),
        issues: this.generateFrameworkIssues(fw),
      };
    });

    const overallCompliance =
      frameworkReports.reduce((sum, r) => sum + r.compliance, 0) /
      Math.max(frameworkReports.length, 1);

    return {
      reportId: `report-${Date.now()}`,
      entityId,
      entityType: 'COMPANY',
      generatedAt: new Date(),
      frameworks,
      summaryStatus:
        overallCompliance > 80
          ? ComplianceStatus.COMPLIANT
          : overallCompliance > 50
            ? ComplianceStatus.IN_PROGRESS
            : ComplianceStatus.NOT_STARTED,
      overallCompliance: Math.round(overallCompliance),
      frameworkReports,
      issues: frameworkReports.flatMap((r) => r.issues),
      recommendations: [
        'Review action items in each framework section',
        'Schedule monthly compliance reviews',
        'Update documentation as needed',
      ],
      nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  private calculateCompliancePercentage(record: any): number {
    // Simplified calculation based on status
    if (!record) return 0;
    if (record.status === 'compliant') return 100;
    if (record.status === 'in_progress') return 60;
    if (record.status === 'pending_review') return 40;
    return 20;
  }
}
