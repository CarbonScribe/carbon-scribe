import { Controller, Post, Body, Logger } from '@nestjs/common';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class SecurityReportDto {
  @IsOptional()
  @IsString()
  'csp-report'?: string;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;
}

@Controller('security')
export class SecurityReportsController {
  private readonly logger = new Logger(SecurityReportsController.name);

  @Post('csp-reports')
  handleCspReport(@Body() report: SecurityReportDto): void {
    this.logger.warn('CSP Violation Report:', JSON.stringify(report, null, 2));
    // Optionally store in database or monitoring system
  }

  @Post('reports')
  handleGeneralReport(@Body() report: SecurityReportDto): void {
    this.logger.warn('Security Report:', JSON.stringify(report, null, 2));
    // Optionally store in database or monitoring system
  }
}
