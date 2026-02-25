import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class TransactionRepository extends BaseRepository<PrismaService['transaction']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.transaction);
  }

  findById(id: string) {
    return this.findUnique({ where: { id } });
  }

  listByCompanyId(companyId: string, options?: { take?: number; skip?: number; type?: string }) {
    return this.findMany({
      where: { companyId, ...(options?.type && { type: options.type }) },
      orderBy: { createdAt: 'desc' },
      take: options?.take ?? 50,
      skip: options?.skip,
    });
  }

  listByOrderId(orderId: string) {
    return this.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }
}
