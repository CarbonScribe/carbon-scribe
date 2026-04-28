import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

interface QuarterlyReportGeneration {
  companyId: string;
  year: number;
  quarter: number;
}

@Injectable()
export class QuarterlyReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(input: QuarterlyReportGeneration) {
    const { companyId, year, quarter } = input;

    // Get all import declarations for the quarter
    const startDate = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
    const endDate = new Date(Date.UTC(year, quarter * 3, 0));

    const declarations = await this.prisma.importDeclaration.findMany({
      where: {
        companyId,
        importDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        goods: true,
      },
    });

    // Calculate totals
    const totalEmissions = declarations.reduce(
      (sum, dec) => sum + dec.totalEmissions,
      0,
    );

    const certificatesRequired = Math.ceil(totalEmissions);

    // Build report data structure
    const reportData = {
      summary: {
        companyId,
        year,
        quarter,
        totalEmissions: Number(totalEmissions.toFixed(6)),
        certificatesRequired,
        totalImportValue: declarations.length,
        numberOfDeclarations: declarations.length,
      },
      declarations: declarations.map((dec) => ({
        id: dec.id,
        goodsName: dec.goods.goodsName,
        cnCode: dec.goods.cnCode,
        quantity: dec.quantity,
        countryOfOrigin: dec.countryOfOrigin,
        emissions: Number(dec.totalEmissions.toFixed(6)),
        certificateCost: dec.certificateCost || 0,
      })),
      certificates: {
        certificatesPurchased: 0,
        certificatesSurrendered: 0,
        certificatesBalance: 0,
        averagePrice: 80, // Default EUR per tCO2e
      },
      calculations: declarations.map((dec) => ({
        goodsId: dec.goodsId,
        calculationMethod: dec.actualEmissions ? 'ACTUAL' : 'DEFAULT',
        actualEmissions: dec.actualEmissions || null,
        defaultEmissions: Number(dec.defaultEmissions.toFixed(6)),
        totalEmissions: Number(dec.totalEmissions.toFixed(6)),
      })),
    };

    // Upsert the quarterly report
    const report = await this.prisma.cbamQuarterlyReport.upsert({
      where: {
        companyId_year_quarter: {
          companyId,
          year,
          quarter,
        },
      },
      update: {
        totalEmissions: Number(totalEmissions.toFixed(6)),
        certificatesRequired,
        reportData: reportData as any,
        status: 'DRAFT',
      },
      create: {
        companyId,
        year,
        quarter,
        totalEmissions: Number(totalEmissions.toFixed(6)),
        certificatesRequired,
        reportData: reportData as any,
        status: 'DRAFT',
      },
    });

    return {
      id: report.id,
      companyId,
      year,
      quarter,
      status: report.status,
      totalEmissions: report.totalEmissions,
      certificatesRequired: report.certificatesRequired,
      generatedAt: report.createdAt || new Date(),
      updatedAt: report.updatedAt || new Date(),
    };
  }

  async getReport(companyId: string, year: number, quarter: number) {
    const report = await this.prisma.cbamQuarterlyReport.findUnique({
      where: {
        companyId_year_quarter: {
          companyId,
          year,
          quarter,
        },
      },
    });

    if (!report) {
      throw new NotFoundException(
        `CBAM report for Q${quarter} ${year} not found`,
      );
    }

    return report;
  }

  async submitReport(
    companyId: string,
    year: number,
    quarter: number,
    submissionId?: string,
  ) {
    const report = await this.getReport(companyId, year, quarter);

    if (report.status === 'SUBMITTED') {
      throw new Error('Report already submitted');
    }

    const updated = await this.prisma.cbamQuarterlyReport.update({
      where: {
        companyId_year_quarter: {
          companyId,
          year,
          quarter,
        },
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submissionId: submissionId || `CBAM-${year}-Q${quarter}-${companyId}`,
      },
    });

    return updated;
  }

  async getReportsByCompany(companyId: string, year?: number) {
    const where: any = { companyId };

    if (year) {
      where.year = year;
    }

    return this.prisma.cbamQuarterlyReport.findMany({
      where,
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });
  }

  async getUpcomingDeadlines(): Promise<DeadlineInfo[]> {
    const deadlines: DeadlineInfo[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    // CBAM reporting deadlines:
    // Q1 (Jan-Mar): Due July 31
    // Q2 (Apr-Jun): Due October 31
    // Q3 (Jul-Sep): Due January 31 next year
    // Q4 (Oct-Dec): Due April 30 next year

    const deadlineConfig = [
      {
        quarter: 1,
        deadlineMonth: 6,
        deadlineDay: 30,
        description: 'Q1 Report',
      },
      {
        quarter: 2,
        deadlineMonth: 9,
        deadlineDay: 30,
        description: 'Q2 Report',
      },
      {
        quarter: 3,
        deadlineMonth: 0,
        deadlineDay: 31,
        yearOffset: 1,
        description: 'Q3 Report',
      },
      {
        quarter: 4,
        deadlineMonth: 3,
        deadlineDay: 30,
        yearOffset: 1,
        description: 'Q4 Report',
      },
    ];

    for (const config of deadlineConfig) {
      const deadlineYear = currentYear + (config.yearOffset || 0);
      const deadlineDate = new Date(
        Date.UTC(deadlineYear, config.deadlineMonth, config.deadlineDay),
      );

      // Check if deadline is in the future
      if (deadlineDate > now) {
        const daysUntilDeadline = Math.floor(
          (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        deadlines.push({
          year: deadlineYear,
          quarter: config.quarter as 1 | 2 | 3 | 4,
          deadlineDate,
          daysUntilDeadline,
          description: config.description,
          isOverdue: false,
        });
      }
    }

    return deadlines.sort(
      (a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime(),
    );
  }
}

export interface DeadlineInfo {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  deadlineDate: Date;
  daysUntilDeadline: number;
  description: string;
  isOverdue: boolean;
}
