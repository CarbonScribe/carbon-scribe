import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import {
  CheckComplianceDto,
  ComplianceFramework,
  EntityType,
} from './dto/check-compliance.dto';
import { ComplianceStatus } from './dto/compliance-status.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private prisma: PrismaService,
    private securityService: SecurityService,
  ) {}

  async checkCompliance(companyId: string, dto: CheckComplianceDto) {
    if (dto.entityType === EntityType.CREDIT) {
      const credit = await this.prisma.credit.findFirst({
        where: { id: dto.entityId, companyId },
      });
      if (!credit) {
        throw new BadRequestException('Credit not found');
      }
    } else if (dto.entityType === EntityType.PROJECT) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.entityId, companyId },
      });
      if (!project) {
        throw new BadRequestException('Project not found');
      }
    }

    const compliance = await this.prisma.compliance.create({
      data: {
        companyId,
        framework: dto.framework,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: ComplianceStatus.COMPLIANT,
        requirements: {},
      },
    });

    await this.securityService.logEvent({
      eventType: 'compliance_check',
      companyId,
      resource: '/api/v1/compliance/check',
      method: 'POST',
      status: 'success',
    });

    return compliance;
  }

  async getComplianceStatus(companyId: string, entityId: string) {
    const entity = await this.prisma.compliance.findFirst({
      where: { id: entityId, companyId },
    });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }

    const compliances = await this.prisma.compliance.findMany({
      where: { companyId, entityId },
    });

    return compliances;
  }

  async getComplianceReport(companyId: string, entityId: string) {
    const compliances = await this.prisma.compliance.findMany({
      where: { companyId, entityId },
    });

    if (compliances.length === 0) {
      throw new NotFoundException('No compliance records found');
    }

    const total = compliances.length;
    const compliant = compliances.filter((c) => c.status === ComplianceStatus.COMPLIANT).length;
    const overallCompliance = (compliant / total) * 100;

    return {
      reportId: `report-${Date.now()}`,
      frameworks: compliances.map((c) => c.framework),
      overallCompliance,
      summaryStatus: overallCompliance > 80 ? 'GOOD' : overallCompliance > 50 ? 'MEDIUM' : 'POOR',
      generatedAt: new Date(),
    };
  }

  async validateCBam(entityId: string) {
    return {
      framework: ComplianceFramework.CBAM,
      issues: ['CBAM validation requires emissions data'],
      requirements: ['Emissions report', 'Carbon price paid'],
      recommendations: ['Submit quarterly emissions reports'],
    };
  }

  async validateCorsia(entityId: string) {
    return {
      framework: ComplianceFramework.CORSIA,
      issues: ['CORSIA requires offset credits'],
      requirements: ['Verified emission units', 'Offset certificates'],
      recommendations: ['Purchase eligible carbon credits'],
    };
  }

  async validateSBTi(entityId: string) {
    return {
      framework: ComplianceFramework.SBTi,
      issues: ['SBTi requires science-based targets'],
      requirements: ['Emission reduction targets', 'Net-zero commitment'],
      recommendations: ['Set near-term emission targets'],
    };
  }

  async validateArticle6(entityId: string) {
    return {
      framework: ComplianceFramework.ARTICLE_6,
      issues: ['Article 6 requires corresponding adjustments'],
      requirements: ['Internationally transferred mitigation outcomes'],
      recommendations: ['Coordinate with host country'],
    };
  }

  async validateCDP(entityId: string) {
    return {
      framework: ComplianceFramework.CDP,
      issues: ['CDP requires detailed climate disclosures'],
      requirements: ['Climate risk assessment', 'Emission inventory'],
      recommendations: ['Complete CDP questionnaire annually'],
    };
  }

  async validateGRI(entityId: string) {
    return {
      framework: ComplianceFramework.GRI,
      issues: ['GRI requires materiality assessment'],
      requirements: ['Sustainability report', 'Stakeholder engagement'],
      recommendations: ['Follow GRI Universal Standards'],
    };
  }

  async validateCSRD(entityId: string) {
    return {
      framework: ComplianceFramework.CSRD,
      issues: ['CSRD requires double materiality assessment'],
      requirements: ['ESRS compliance', 'Audit trail'],
      recommendations: ['Implement CSRD-ready reporting systems'],
    };
  }

  async validateTCFD(entityId: string) {
    return {
      framework: ComplianceFramework.TCFD,
      issues: ['TCFD requires scenario analysis'],
      requirements: ['Climate risk governance', 'Metrics and targets'],
      recommendations: ['Adopt TCFD recommendations'],
    };
  }

  // ========== RETIREMENT HISTORY QUERYING (Issue #234) ==========
  // Note: These methods will work once RetirementTrackerService is properly imported
  // TODO: Add RetirementTrackerService to constructor when available

  async queryRetirements(
    companyId: string,
    query: {
      entity?: string;
      tokenId?: string;
      framework?: string;
      startYear?: number;
      endYear?: number;
      page?: number;
      limit?: number;
    },
  ) {
    this.logger.log(`Querying retirements for company ${companyId}`);
    
    // TODO: Replace with actual RetirementTrackerService call
    return {
      success: true,
      framework: query.framework || 'none',
      total: 0,
      data: [],
      message: 'RetirementTrackerService integration pending',
    };
  }

  async getRetirementByTokenId(companyId: string, tokenId: string) {
    // TODO: Replace with actual RetirementTrackerService call
    return {
      success: true,
      data: null,
      message: `Retirement for token ${tokenId} - integration pending`,
    };
  }

  async getRetirementsByEntity(companyId: string, address: string, page: number = 1, limit: number = 20) {
    // TODO: Replace with actual RetirementTrackerService call
    return {
      success: true,
      entity: address,
      total: 0,
      data: [],
      message: 'RetirementTrackerService integration pending',
    };
  }
}