import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { GoodsClassificationService } from './services/goods-classification.service';
import { EmbeddedEmissionsService } from './services/embedded-emissions.service';
import { QuarterlyReportService } from './services/quarterly-report.service';
import { CertificateTrackingService } from './services/certificate-tracking.service';
import { ImportDeclarationDto } from './dto/import-declaration.dto';
import {
  GenerateReportDto,
  SubmitReportDto,
  CalculateEmissionsDto,
} from './dto/report-submission.dto';

@Injectable()
export class CbamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly goodsClassificationService: GoodsClassificationService,
    private readonly embeddedEmissionsService: EmbeddedEmissionsService,
    private readonly quarterlyReportService: QuarterlyReportService,
    private readonly certificateTrackingService: CertificateTrackingService,
  ) {}

  // Goods Classification
  async getCbamSectors() {
    return this.goodsClassificationService.getCbamSectors();
  }

  async listGoods(companyId: string, sector?: any) {
    return this.goodsClassificationService.listGoods(companyId, { sector });
  }

  async getGoodById(id: string, companyId: string) {
    return this.goodsClassificationService.getGoodById(id, companyId);
  }

  // Import Declarations
  async recordImportDeclaration(companyId: string, dto: ImportDeclarationDto) {
    const good = await this.goodsClassificationService.getGoodById(
      dto.goodsId,
      companyId,
    );

    // Validate installation ID if provided
    if (
      dto.installationId &&
      !this.embeddedEmissionsService.validateInstallationId(dto.installationId)
    ) {
      throw new BadRequestException('Invalid EU installation ID format');
    }

    // Calculate emissions
    const calculation =
      this.embeddedEmissionsService.calculateEmbeddedEmissions({
        companyId,
        goodsId: good.sector,
        quantity: dto.quantity,
        quantityUnit: dto.quantityUnit,
        countryOfOrigin: dto.countryOfOrigin,
        actualEmissions: dto.actualEmissions,
        installationId: dto.installationId,
      });

    // Calculate certificate cost
    const certificateCost =
      this.embeddedEmissionsService.calculateCertificateCost(
        calculation.totalEmissions,
      );

    const declaration = await this.prisma.importDeclaration.create({
      data: {
        companyId,
        goodsId: dto.goodsId,
        importDate: new Date(dto.importDate),
        quantity: dto.quantity,
        quantityUnit: dto.quantityUnit,
        countryOfOrigin: dto.countryOfOrigin,
        installationId: dto.installationId,
        actualEmissions: calculation.actualEmissions || 0,
        defaultEmissions: calculation.defaultEmissions,
        totalEmissions: calculation.totalEmissions,
        certificateCost,
        metadata: dto.metadata as any,
      },
      include: {
        goods: true,
      },
    });

    await this.securityService.logEvent({
      eventType: 'cbam.import.declared' as any,
      companyId,
      details: {
        declarationId: declaration.id,
        goodsId: dto.goodsId,
        emissions: calculation.totalEmissions,
      },
      status: 'success',
    });

    return declaration;
  }

  async listImportDeclarations(companyId: string, year?: number) {
    const where: any = { companyId };

    if (year) {
      where.importDate = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    return this.prisma.importDeclaration.findMany({
      where,
      include: {
        goods: true,
      },
      orderBy: { importDate: 'desc' },
    });
  }

  // Emissions Calculations
  async calculateEmissions(companyId: string, dto: CalculateEmissionsDto) {
    const good = await this.goodsClassificationService.getGoodById(
      dto.goodsId,
      companyId,
    );

    const calculation =
      this.embeddedEmissionsService.calculateEmbeddedEmissions({
        companyId,
        goodsId: good.sector,
        quantity: dto.quantity,
        quantityUnit: dto.quantityUnit,
        countryOfOrigin: dto.countryOfOrigin,
        actualEmissions: dto.actualEmissions,
        installationId: dto.installationId,
      });

    const certificateCost =
      this.embeddedEmissionsService.calculateCertificateCost(
        calculation.totalEmissions,
      );

    return {
      ...calculation,
      certificateCost,
      goodsName: good.goodsName,
      cnCode: good.cnCode,
    };
  }

  // Quarterly Reports
  async generateQuarterlyReport(companyId: string, dto: GenerateReportDto) {
    const result = await this.quarterlyReportService.generateReport({
      companyId,
      year: dto.year,
      quarter: dto.quarter,
    });

    await this.securityService.logEvent({
      eventType: 'cbam.report.generated' as any,
      companyId,
      details: {
        year: dto.year,
        quarter: dto.quarter,
        reportId: result.id,
        totalEmissions: result.totalEmissions,
      },
      status: 'success',
    });

    return result;
  }

  async getQuarterlyReports(companyId: string, year?: number) {
    return this.quarterlyReportService.getReportsByCompany(companyId, year);
  }

  async getQuarterlyReport(companyId: string, year: number, quarter: number) {
    return this.quarterlyReportService.getReport(companyId, year, quarter);
  }

  async submitQuarterlyReport(companyId: string, dto: SubmitReportDto) {
    const report = await this.quarterlyReportService.submitReport(
      companyId,
      parseInt(dto.reportId.split('-')[1]),
      parseInt(dto.reportId.split('-')[2].replace('Q', '')),
      dto.submissionNotes,
    );

    await this.securityService.logEvent({
      eventType: 'cbam.report.submitted' as any,
      companyId,
      details: {
        reportId: report.id,
        submissionId: report.submissionId,
      },
      status: 'success',
    });

    return report;
  }

  // Certificates
  async getCertificateStatus(companyId: string, year: number, quarter: number) {
    return this.certificateTrackingService.getCertificateStatus(
      companyId,
      year,
      quarter,
    );
  }

  async getCertificateHistory(companyId: string, year?: number) {
    return this.certificateTrackingService.getCertificateHistory(
      companyId,
      year,
    );
  }

  async recordCertificatePurchase(
    companyId: string,
    year: number,
    quarter: number,
    quantity: number,
    pricePerCertificate: number,
  ) {
    return this.certificateTrackingService.recordCertificatePurchase(
      companyId,
      year,
      quarter,
      quantity,
      pricePerCertificate,
    );
  }

  async surrenderCertificates(
    companyId: string,
    year: number,
    quarter: number,
    quantity: number,
  ) {
    return this.certificateTrackingService.surrenderCertificates(
      companyId,
      year,
      quarter,
      quantity,
    );
  }

  // Deadlines
  async getUpcomingDeadlines() {
    return this.quarterlyReportService.getUpcomingDeadlines();
  }
}
