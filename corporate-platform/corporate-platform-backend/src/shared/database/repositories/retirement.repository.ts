import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class RetirementRepository extends BaseRepository<PrismaService['retirement']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.retirement);
  }

  findById(id: string) {
    return this.findUnique({ where: { id }, include: { company: true, credit: true, user: true } });
  }

  listByCompanyId(companyId: string, options?: { take?: number; skip?: number }) {
    return this.findMany({
      where: { companyId },
      orderBy: { retiredAt: 'desc' },
      take: options?.take ?? 50,
      skip: options?.skip,
      include: { credit: true, user: true },
    });
  }

  listByUserId(userId: string, companyId: string) {
    return this.findMany({
      where: { userId, companyId },
      orderBy: { retiredAt: 'desc' },
    });
  }

  aggregateByCompanyId(companyId: string) {
    return this.prisma.retirement.aggregate({
      where: { companyId },
      _sum: { amount: true },
      _count: true,
    });
  }
}
