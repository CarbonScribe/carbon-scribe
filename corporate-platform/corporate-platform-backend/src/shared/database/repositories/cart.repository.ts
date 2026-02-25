import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class CartRepository extends BaseRepository<PrismaService['cart']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.cart);
  }

  findById(id: string) {
    return this.findUnique({ where: { id }, include: { items: { include: { credit: true } } } });
  }

  findBySessionId(sessionId: string) {
    return this.findUnique({ where: { sessionId }, include: { items: { include: { credit: true } } } });
  }

  listByCompanyId(companyId: string) {
    return this.findMany({ where: { companyId }, orderBy: { updatedAt: 'desc' }, include: { items: true } });
  }

  listExpired(expiresBefore: Date) {
    return this.findMany({ where: { expiresAt: { lt: expiresBefore } } });
  }
}
