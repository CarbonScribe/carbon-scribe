import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class CompanyRepository extends BaseRepository<PrismaService['company']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.company);
  }

  /** Find company by id with optional relations. */
  findById(id: string, include?: { users?: boolean; retirements?: boolean }) {
    return this.findUnique({ where: { id }, include: include as any });
  }

  /** List companies with optional filters (multi-tenant listing for admin). */
  listByCompanyIds(companyIds: string[]) {
    return this.findMany({ where: { id: { in: companyIds } }, orderBy: { name: 'asc' } });
  }
}
