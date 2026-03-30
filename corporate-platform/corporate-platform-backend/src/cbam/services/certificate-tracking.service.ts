import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../security/security.service';

@Injectable()
export class CertificateTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  async getCertificateStatus(companyId: string, year: number, quarter: number) {
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

    const reportData = report.reportData as any;
    const certificates = reportData.certificates || {};

    return {
      companyId,
      year,
      quarter,
      certificatesRequired: report.certificatesRequired,
      certificatesPurchased: report.certificatesPurchased || 0,
      certificatesSurrendered: certificates.certificatesSurrendered || 0,
      certificatesBalance:
        (report.certificatesPurchased || 0) -
        (certificates.certificatesSurrendered || 0),
      averagePrice: certificates.averagePrice || 0,
      totalValue:
        ((report.certificatesPurchased || 0) -
          (certificates.certificatesSurrendered || 0)) *
        (certificates.averagePrice || 0),
    };
  }

  async recordCertificatePurchase(
    companyId: string,
    year: number,
    quarter: number,
    quantity: number,
    pricePerCertificate: number,
  ) {
    const report = await this.prisma.cbamQuarterlyReport.upsert({
      where: {
        companyId_year_quarter: {
          companyId,
          year,
          quarter,
        },
      },
      update: {
        certificatesPurchased: {
          increment: quantity,
        },
      },
      create: {
        companyId,
        year,
        quarter,
        status: 'DRAFT',
        totalEmissions: 0,
        certificatesRequired: 0,
        certificatesPurchased: quantity,
        reportData: {
          summary: {
            companyId,
            year,
            quarter,
            totalEmissions: 0,
            certificatesRequired: 0,
            totalImportValue: 0,
            numberOfDeclarations: 0,
          },
          declarations: [],
          certificates: {
            certificatesPurchased: quantity,
            certificatesSurrendered: 0,
            certificatesBalance: quantity,
            averagePrice: pricePerCertificate,
          },
          calculations: [],
        },
      },
    });

    await this.securityService.logEvent({
      eventType: 'cbam.certificate.purchased' as any,
      companyId,
      details: {
        year,
        quarter,
        quantity,
        pricePerCertificate,
        totalCost: quantity * pricePerCertificate,
      },
      status: 'success',
    });

    return report;
  }

  async surrenderCertificates(
    companyId: string,
    year: number,
    quarter: number,
    quantity: number,
  ) {
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

    const currentBalance =
      (report.certificatesPurchased || 0) -
      ((report.reportData as any)?.certificates?.certificatesSurrendered || 0);

    if (currentBalance < quantity) {
      throw new Error(
        `Insufficient certificate balance. Available: ${currentBalance}, Requested: ${quantity}`,
      );
    }

    const reportData = report.reportData as any;
    const updatedCertificates = {
      certificatesPurchased: report.certificatesPurchased || 0,
      certificatesSurrendered:
        (reportData.certificates?.certificatesSurrendered || 0) + quantity,
      certificatesBalance: currentBalance - quantity,
      averagePrice: reportData.certificates?.averagePrice || 0,
    };

    const updated = await this.prisma.cbamQuarterlyReport.update({
      where: {
        companyId_year_quarter: {
          companyId,
          year,
          quarter,
        },
      },
      data: {
        reportData: {
          ...reportData,
          certificates: updatedCertificates,
        },
      },
    });

    await this.securityService.logEvent({
      eventType: 'cbam.certificate.surrendered' as any,
      companyId,
      details: {
        year,
        quarter,
        quantity,
        remainingBalance: updatedCertificates.certificatesBalance,
      },
      status: 'success',
    });

    return updated;
  }

  async getCertificateHistory(companyId: string, year?: number) {
    const where: any = { companyId };

    if (year) {
      where.year = year;
    }

    return this.prisma.cbamQuarterlyReport.findMany({
      where,
      select: {
        year: true,
        quarter: true,
        certificatesRequired: true,
        certificatesPurchased: true,
        reportData: true,
        submittedAt: true,
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });
  }

  calculateCertificatesRequired(emissions: number): number {
    // 1 certificate = 1 tCO2e
    return Math.ceil(emissions);
  }
}
