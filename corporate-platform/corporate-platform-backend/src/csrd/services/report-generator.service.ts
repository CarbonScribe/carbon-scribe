import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ReportGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(companyId: string, year: number) {
    const report = await this.prisma.csrdReport.create({
      data: {
        companyId,
        reportingYear: year,
        status: 'DRAFT',
      },
    });

    // In a real app, this would trigger an async job to build the XHTML/iXBRL
    // and upload it to storage, then update reportUrl
    const reportUrl = `https://storage.carbon-scribe.com/reports/${report.id}.xhtml`;

    return this.prisma.csrdReport.update({
      where: { id: report.id },
      data: {
        reportUrl,
        metadata: {
          generatedAt: new Date(),
          format: 'XHTML/iXBRL',
        },
      },
    });
  }
}
