import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreditRepository } from '../../shared/database/repositories/credit.repository';

@Injectable()
export class DetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditRepo: CreditRepository,
  ) {}

  async getById(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;

    const credit = await this.creditRepo.findFirst({
      where,
      include: { project: true },
    });
    if (!credit) throw new NotFoundException('Credit not found');

    // normalize SDGs to number[] if stored differently
    return credit;
  }
}
