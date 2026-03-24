import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listAvailable(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({ where: { status: 'available' }, skip, take: limit }),
      this.prisma.credit.count({ where: { status: 'available' } }),
    ]);
    return { data, total, page, limit };
  }

  async updateStatus(id: string, status: string, availableAmount?: number) {
    const credit = await this.prisma.credit.findUnique({ where: { id } });
    if (!credit) throw new NotFoundException('Credit not found');

    // Basic state machine sanity: disallow invalid transitions
    const allowed = ['available', 'reserved', 'retired', 'pending'];
    if (!allowed.includes(status)) throw new BadRequestException('Invalid status');

    const data: any = { status };
    if (typeof availableAmount === 'number') {
      if (availableAmount < 0) throw new BadRequestException('availableAmount must be >= 0');
      data.availableAmount = availableAmount;
    }

    return this.prisma.credit.update({ where: { id }, data });
  }

  // Decrement inventory safely using a transaction
  async decrementAvailability(id: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('amount must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const c = await tx.credit.findUnique({ where: { id } });
      if (!c) throw new NotFoundException('Credit not found');
      if ((c.availableAmount ?? 0) < amount) throw new BadRequestException('Insufficient availability');

      const newAvailable = (c.availableAmount ?? 0) - amount;
      const newStatus = newAvailable === 0 ? 'reserved' : c.status;

      return tx.credit.update({ where: { id }, data: { availableAmount: newAvailable, status: newStatus } });
    });
  }
}
