import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class ActivityRepository extends BaseRepository<PrismaService['activity']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.activity);
  }

  findById(id: string) {
    return this.findUnique({ where: { id } });
  }

  listByCompanyId(companyId: string, options?: { userId?: string; action?: string; take?: number }) {
    return this.findMany({
      where: {
        companyId,
        ...(options?.userId && { userId: options.userId }),
        ...(options?.action && { action: options.action }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.take ?? 100,
    });
  }
}
