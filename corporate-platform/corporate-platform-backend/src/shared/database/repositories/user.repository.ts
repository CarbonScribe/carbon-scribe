import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class UserRepository extends BaseRepository<PrismaService['user']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.user);
  }

  findByEmail(email: string) {
    return this.findUnique({ where: { email } });
  }

  findByCompanyAndEmail(companyId: string, email: string) {
    return this.findUnique({ where: { companyId_email: { companyId, email } } });
  }

  listByCompanyId(companyId: string, options?: { take?: number; skip?: number }) {
    return this.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, ...options });
  }

  countByCompanyId(companyId: string) {
    return this.count({ where: { companyId } });
  }
}
