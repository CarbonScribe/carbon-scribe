import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { MethodologyMappingService } from './methodology-mapping.service';
import { ValidationResultDto } from '../dto/validate-methodology.dto';
import {
  CrossComplianceReportDto,
  FrameworkCoverage,
} from '../dto/cross-compliance-report.dto';

@Injectable()
export class CrossComplianceService {
  constructor(
    private prisma: PrismaService,
    private mappingService: MethodologyMappingService,
  ) {}

  async validateMethodologyForFramework(
    tokenId: number,
    frameworkCode: string,
  ): Promise<ValidationResultDto> {
    const framework = await this.prisma.framework.findUnique({
      where: { code: frameworkCode },
    });

    if (!framework) {
      throw new NotFoundException(
        `Framework with code ${frameworkCode} not found`,
      );
    }

    const mapping = await this.prisma.frameworkMethodologyMapping.findFirst({
      where: {
        methodologyTokenId: tokenId,
        frameworkId: framework.id,
        isActive: true,
      },
    });

    const frameworkRequirements = (framework.requirements as any[]) || [];
    const allRequirementIds = frameworkRequirements.map((r) => r.id);
    const mappedRequirementIds = (mapping?.requirementIds as string[]) || [];
    const missingRequirementIds = allRequirementIds.filter(
      (id) => !mappedRequirementIds.includes(id),
    );

    return {
      isValid: mappedRequirementIds.length > 0,
      frameworkCode,
      methodologyTokenId: tokenId,
      mappedRequirements: mappedRequirementIds,
      missingRequirements: missingRequirementIds,
      reasons:
        mappedRequirementIds.length === 0
          ? [
              'No mapping found or no requirements fulfilled by this methodology',
            ]
          : [],
    };
  }

  async generateCrossComplianceReport(
    companyId: string,
    frameworkCodes?: string[],
  ): Promise<CrossComplianceReportDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        portfolios: {
          include: {
            holdings: {
              include: {
                credit: true,
              },
            },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    // Get all methodologies in company portfolio
    const portfolioMethodologies = new Set<string>();
    company.portfolios.forEach((p) => {
      p.holdings.forEach((h) => {
        if (h.credit.methodology) {
          portfolioMethodologies.add(h.credit.methodology);
        }
      });
    });

    // Find SyncedMethodologies for these methodology names
    // This assumes credit.methodology name matches SyncedMethodology.name or we have a way to link them
    // For now, let's look them up by name
    const syncedMethodologies = await this.prisma.syncedMethodology.findMany({
      where: {
        name: { in: Array.from(portfolioMethodologies) },
      },
    });

    const methodologyIds = syncedMethodologies.map((m) => m.id);

    // Get frameworks
    const frameworks = await this.prisma.framework.findMany({
      where: frameworkCodes ? { code: { in: frameworkCodes } } : {},
      include: {
        mappings: {
          where: {
            methodologyId: { in: methodologyIds },
            isActive: true,
          },
        },
      },
    });

    const frameworkCoverages: FrameworkCoverage[] = frameworks.map((f) => {
      const frameworkRequirements = (f.requirements as any[]) || [];
      const totalRequirements = frameworkRequirements.length;

      const mappedRequirementIds = new Set<string>();
      f.mappings.forEach((m) => {
        (m.requirementIds as string[]).forEach((rid) =>
          mappedRequirementIds.add(rid),
        );
      });

      const coveragePercentage =
        totalRequirements > 0
          ? (mappedRequirementIds.size / totalRequirements) * 100
          : 0;

      const unmappedRequirements = frameworkRequirements
        .filter((r) => !mappedRequirementIds.has(r.id))
        .map((r) => r.id);

      return {
        frameworkCode: f.code,
        frameworkName: f.name,
        totalRequirements,
        mappedRequirements: mappedRequirementIds.size,
        coveragePercentage,
        unmappedRequirements,
      };
    });

    const overallCoverage =
      frameworkCoverages.length > 0
        ? frameworkCoverages.reduce(
            (sum, fc) => sum + fc.coveragePercentage,
            0,
          ) / frameworkCoverages.length
        : 0;

    return {
      companyId,
      generatedAt: new Date(),
      overallCoverage,
      frameworkCoverages,
    };
  }
}
