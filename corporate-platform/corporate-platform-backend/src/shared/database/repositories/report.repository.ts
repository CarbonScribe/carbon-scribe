import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class ReportRepository extends BaseRepository<PrismaService['report']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.report);
  }

  findById(id: string) {
    return this.findUnique({ where: { id } });
  }

  listByCompanyId(companyId: string, options?: { type?: string; take?: number }) {
    return this.findMany({
      where: { companyId, ...(options?.type && { type: options.type }) },
      orderBy: { generatedAt: 'desc' },
      take: options?.take ?? 30,
    });
  }
}
