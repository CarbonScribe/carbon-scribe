import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class PortfolioRepository extends BaseRepository<PrismaService['portfolio']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.portfolio);
  }

  findById(id: string) {
    return this.findUnique({ where: { id }, include: { entries: { include: { credit: true } } } });
  }

  listByCompanyId(companyId: string, options?: { take?: number; orderBy?: object }) {
    return this.findMany({
      where: { companyId },
      orderBy: { asOfDate: 'desc' },
      take: options?.take ?? 20,
      include: { entries: true },
    });
  }

  getLatestByCompanyId(companyId: string) {
    return this.findFirst({
      where: { companyId },
      orderBy: { asOfDate: 'desc' },
      include: { entries: { include: { credit: true } } },
    });
  }
}
