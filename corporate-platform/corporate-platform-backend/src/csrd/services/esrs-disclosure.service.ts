import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  DisclosureQueryDto,
  RecordDisclosureDto,
} from '../dto/disclosure-query.dto';

@Injectable()
export class EsrsDisclosureService {
  constructor(private readonly prisma: PrismaService) {}

  async record(companyId: string, dto: RecordDisclosureDto) {
    return this.prisma.esrsDisclosure.create({
      data: {
        companyId,
        reportingPeriod: dto.reportingPeriod,
        standard: dto.standard,
        disclosureRequirement: dto.disclosureRequirement,
        dataPoint: dto.dataPoint,
        value: dto.value,
        assuranceLevel: dto.assuranceLevel,
      },
    });
  }

  async list(companyId: string, query: DisclosureQueryDto) {
    const where: any = { companyId };
    if (query.reportingPeriod) where.reportingPeriod = query.reportingPeriod;
    if (query.standard) where.standard = query.standard;

    return this.prisma.esrsDisclosure.findMany({
      where,
      orderBy: { standard: 'asc' },
    });
  }

  async getRequirements(standard?: string) {
    // In a real app, this would fetch from FrameworkRegistry
    const framework = await this.prisma.framework.findUnique({
      where: { code: 'CSRD' },
    });

    if (!framework) {
      throw new NotFoundException('CSRD framework not found in registry');
    }

    const requirements = (framework.requirements as any[]) || [];
    return standard
      ? requirements.filter((r) => r.standard === standard)
      : requirements;
  }
}
