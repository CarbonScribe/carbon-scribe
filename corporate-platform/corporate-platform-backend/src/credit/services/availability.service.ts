import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreditUpdateDto, CreditStatus } from '../dto/credit-update.dto';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async updateStatus(id: string, updateDto: CreditUpdateDto) {
    const credit = await this.prisma.credit.findUnique({
      where: { id },
    });

    if (!credit) {
      throw new BadRequestException('Credit not found');
    }

    return this.prisma.credit.update({
      where: { id },
      data: updateDto,
    });
  }

  async getAvailableOnly(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({
        where: {
          status: CreditStatus.AVAILABLE,
          availableAmount: { gt: 0 },
        },
        skip,
        take: limit,
        include: {
          project: true,
        },
      }),
      this.prisma.credit.count({
        where: {
          status: CreditStatus.AVAILABLE,
          availableAmount: { gt: 0 },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async decrementInventory(id: string, amount: number) {
    return this.prisma.$transaction(async (tx) => {
      const credit = await tx.credit.findUnique({
        where: { id },
      });

      if (!credit || credit.availableAmount < amount) {
        throw new BadRequestException('Insufficient credit availability');
      }

      const updated = await tx.credit.update({
        where: { id },
        data: {
          availableAmount: {
            decrement: amount,
          },
          status:
            credit.availableAmount - amount === 0
              ? CreditStatus.RETIRED
              : credit.status,
        },
      });

      return updated;
    });
  }
}
