import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class DetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const credit = await this.prisma.credit.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!credit) throw new NotFoundException('Credit not found');

    // normalize SDGs to number[] if stored differently
    return credit;
  }
}
