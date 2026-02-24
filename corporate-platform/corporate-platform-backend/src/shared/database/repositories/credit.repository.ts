import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class CreditRepository extends BaseRepository<PrismaService['credit']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.credit);
  }

  findById(id: string) {
    return this.findUnique({ where: { id } });
  }

  listAvailable(limit = 50) {
    return this.findMany({ where: { available: { gt: 0 } }, orderBy: { available: 'desc' }, take: limit });
  }

  listByProjectId(projectId: string) {
    return this.findMany({ where: { projectId }, orderBy: { projectName: 'asc' } });
  }

  countAvailable() {
    return this.prisma.credit.aggregate({ _sum: { available: true }, where: { available: { gt: 0 } } });
  }
}
