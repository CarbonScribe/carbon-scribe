import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class ComplianceRepository extends BaseRepository<PrismaService['compliance']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.compliance);
  }

  findById(id: string) {
    return this.findUnique({ where: { id } });
  }

  listByCompanyId(companyId: string) {
    return this.findMany({ where: { companyId }, orderBy: { dueDate: 'asc' } });
  }

  findByCompanyAndFramework(companyId: string, framework: string) {
    return this.findFirst({ where: { companyId, framework } });
  }
}
