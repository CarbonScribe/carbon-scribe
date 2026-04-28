import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Headers,
} from '@nestjs/common';
import { CbamService } from './cbam.service';
import { ImportDeclarationDto } from './dto/import-declaration.dto';
import {
  GenerateReportDto,
  SubmitReportDto,
  CalculateEmissionsDto,
} from './dto/report-submission.dto';

@Controller('api/v1/cbam')
export class CbamController {
  constructor(private readonly cbamService: CbamService) {}

  // Goods Classification
  @Get('goods')
  async getCbamGoods(
    @Headers('x-company-id') companyId: string,
    @Query('sector') sector?: string,
  ) {
    return this.cbamService.listGoods(companyId, sector as any);
  }

  @Get('sectors')
  async getCbamSectors() {
    return this.cbamService.getCbamSectors();
  }

  @Get('goods/:id')
  async getGoodById(
    @Param('id') id: string,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.getGoodById(id, companyId);
  }

  // Import Declarations
  @Post('imports/declare')
  async recordImportDeclaration(
    @Body() dto: ImportDeclarationDto,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.recordImportDeclaration(companyId, dto);
  }

  @Get('imports')
  async listImportDeclarations(
    @Headers('x-company-id') companyId: string,
    @Query('year', ParseIntPipe) year?: number,
  ) {
    return this.cbamService.listImportDeclarations(companyId, year);
  }

  // Emissions Calculations
  @Post('calculate')
  async calculateEmissions(
    @Body() dto: CalculateEmissionsDto,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.calculateEmissions(companyId, dto);
  }

  // Quarterly Reports
  @Post('reports/generate')
  async generateQuarterlyReport(
    @Body() dto: GenerateReportDto,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.generateQuarterlyReport(companyId, dto);
  }

  @Get('reports/quarterly')
  async getQuarterlyReports(
    @Headers('x-company-id') companyId: string,
    @Query('year', ParseIntPipe) year?: number,
  ) {
    return this.cbamService.getQuarterlyReports(companyId, year);
  }

  @Get('reports/quarterly/:year/:quarter')
  async getQuarterlyReport(
    @Param('year', ParseIntPipe) year: number,
    @Param('quarter', ParseIntPipe) quarter: number,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.getQuarterlyReport(companyId, year, quarter);
  }

  @Post('reports/submit')
  async submitQuarterlyReport(
    @Body() dto: SubmitReportDto,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.submitQuarterlyReport(companyId, dto);
  }

  // Certificates
  @Get('certificates')
  async getCertificateHistory(
    @Headers('x-company-id') companyId: string,
    @Query('year', ParseIntPipe) year?: number,
  ) {
    return this.cbamService.getCertificateHistory(companyId, year);
  }

  @Get('certificates/:year/:quarter')
  async getCertificateStatus(
    @Param('year', ParseIntPipe) year: number,
    @Param('quarter', ParseIntPipe) quarter: number,
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.getCertificateStatus(companyId, year, quarter);
  }

  @Post('certificates/purchase')
  async recordCertificatePurchase(
    @Body()
    body: {
      year: number;
      quarter: number;
      quantity: number;
      pricePerCertificate: number;
    },
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.recordCertificatePurchase(
      companyId,
      body.year,
      body.quarter,
      body.quantity,
      body.pricePerCertificate,
    );
  }

  @Post('certificates/surrender')
  async surrenderCertificates(
    @Body()
    body: {
      year: number;
      quarter: number;
      quantity: number;
    },
    @Headers('x-company-id') companyId: string,
  ) {
    return this.cbamService.surrenderCertificates(
      companyId,
      body.year,
      body.quarter,
      body.quantity,
    );
  }

  // Deadlines
  @Get('deadlines')
  async getUpcomingDeadlines() {
    return this.cbamService.getUpcomingDeadlines();
  }
}
