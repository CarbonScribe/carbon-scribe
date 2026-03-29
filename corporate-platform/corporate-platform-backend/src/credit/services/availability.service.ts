import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

type Status = 'available' | 'reserved' | 'retired' | 'pending';

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  available: ['reserved', 'pending'],
  reserved: ['available', 'retired'],
  pending: ['available', 'reserved'],
  retired: [],
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listAvailable(page = 1, limit = 20, companyId?: string) {
    const skip = (page - 1) * limit;
    const where: any = { status: 'available' };
    if (companyId) where.companyId = companyId;
    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({ where, skip, take: limit }),
      this.prisma.credit.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateStatus(
    id: string,
    status: string,
    availableAmount?: number,
    companyId?: string,
  ) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;
    const credit = await this.prisma.credit.findFirst({ where });
    if (!credit) throw new NotFoundException('Credit not found');

    if (!['available', 'reserved', 'retired', 'pending'].includes(status))
      throw new BadRequestException('Invalid status');

    // enforce allowed transitions
    const from = (credit.status as Status) || 'available';
    if (
      !ALLOWED_TRANSITIONS[from].includes(status as Status) &&
      from !== (status as Status)
    ) {
      throw new BadRequestException(
        `Invalid state transition from ${from} to ${status}`,
      );
    }

    const data: any = { status };
    if (typeof availableAmount === 'number') {
      if (availableAmount < 0)
        throw new BadRequestException('availableAmount must be >= 0');
      data.availableAmount = availableAmount;
    }

    return this.prisma.$transaction(async (tx) => {
      const txWhere: any = { id };
      if (companyId) txWhere.companyId = companyId;
      const updated = await tx.credit.update({ where: txWhere, data });
      // log the status change
      await tx.creditAvailabilityLog.create({
        data: {
          creditId: id,
          changedBy: 'system',
          changeType: 'status_change',
          amount: updated.availableAmount ?? 0,
          previousAmount: credit.availableAmount ?? 0,
          newAmount: updated.availableAmount ?? 0,
          reason: `status:${from}->${status}`,
        },
      });
      return updated;
    });
  }

  // Decrement inventory safely using a transaction
  async decrementAvailability(
    id: string,
    amount: number,
    changedBy = 'system',
    reason?: string,
    companyId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('amount must be > 0');

    return this.prisma.$transaction(async (tx) => {
      const where: any = { id };
      if (companyId) where.companyId = companyId;
      const c = await tx.credit.findFirst({ where });
      if (!c) throw new NotFoundException('Credit not found');
      if ((c.availableAmount ?? 0) < amount)
        throw new BadRequestException('Insufficient availability');

      const newAvailable = (c.availableAmount ?? 0) - amount;
      const newStatus = newAvailable === 0 ? 'reserved' : c.status;
      const txWhere: any = { id };
      if (companyId) txWhere.companyId = companyId;
      const updated = await tx.credit.update({
        where: txWhere,
        data: { availableAmount: newAvailable, status: newStatus },
      });

      await tx.creditAvailabilityLog.create({
        data: {
          creditId: id,
          changedBy,
          changeType: 'decrement',
          amount,
          previousAmount: c.availableAmount ?? 0,
          newAmount: newAvailable,
          reason: reason ?? null,
        },
      });

      return updated;
    });
  }
}
