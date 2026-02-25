import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class ProjectRepository extends BaseRepository<PrismaService['project']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.project);
  }

  findById(id: string) {
    return this.findUnique({ where: { id }, include: { credits: true } });
  }

  listByCompanyId(companyId: string) {
    return this.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  listGlobal() {
    return this.findMany({ where: { companyId: null }, orderBy: { name: 'asc' } });
  }
}
