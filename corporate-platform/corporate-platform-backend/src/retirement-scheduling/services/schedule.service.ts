import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, createdBy: string, dto: CreateScheduleDto) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate');
    }

    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (
      dto.creditSelection === 'specific' &&
      (!dto.creditIds || !dto.creditIds.length)
    ) {
      throw new BadRequestException(
        'creditIds are required when creditSelection is specific',
      );
    }

    const nextRunDate = startDate;

    return this.prisma.retirementSchedule.create({
      data: {
        companyId,
        createdBy,
        name: dto.name,
        description: dto.description,
        purpose: dto.purpose,
        amount: dto.amount,
        creditSelection: dto.creditSelection,
        creditIds: dto.creditIds || [],
        frequency: dto.frequency,
        interval: dto.interval,
        startDate,
        endDate,
        nextRunDate,
        notifyBefore: dto.notifyBefore,
        notifyAfter: dto.notifyAfter ?? true,
      },
    });
  }

  async list(companyId: string) {
    return this.prisma.retirementSchedule.findMany({
      where: { companyId },
      orderBy: { nextRunDate: 'asc' },
    });
  }

  async getById(companyId: string, id: string) {
    const schedule = await this.prisma.retirementSchedule.findFirst({
      where: { id, companyId },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async update(companyId: string, id: string, dto: UpdateScheduleDto) {
    const existing = await this.getById(companyId, id);

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate');
    }

    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const frequency = dto.frequency || existing.frequency;
    const interval = dto.interval ?? existing.interval;

    const nextRunDate =
      existing.runCount > 0
        ? this.calculateNextRunDate(
            existing.lastRunDate || existing.nextRunDate,
            frequency,
            interval,
          )
        : startDate;

    return this.prisma.retirementSchedule.update({
      where: { id: existing.id },
      data: {
        name: dto.name,
        description: dto.description,
        purpose: dto.purpose,
        amount: dto.amount,
        creditSelection: dto.creditSelection,
        creditIds: dto.creditIds,
        frequency,
        interval,
        startDate,
        endDate,
        nextRunDate,
        notifyBefore: dto.notifyBefore,
        notifyAfter: dto.notifyAfter,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.getById(companyId, id);
    await this.prisma.retirementSchedule.delete({ where: { id: existing.id } });
    return { deleted: true };
  }

  async pause(companyId: string, id: string) {
    const existing = await this.getById(companyId, id);
    return this.prisma.retirementSchedule.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  async resume(companyId: string, id: string) {
    const existing = await this.getById(companyId, id);
    return this.prisma.retirementSchedule.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        nextRunDate:
          existing.nextRunDate < new Date() ? new Date() : existing.nextRunDate,
      },
    });
  }

  async getExecutions(companyId: string, id: string) {
    await this.getById(companyId, id);
    return this.prisma.scheduleExecution.findMany({
      where: {
        scheduleId: id,
        schedule: { companyId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  calculateNextRunDate(
    baseDate: Date,
    frequency: string,
    interval?: number | null,
    fromDate?: Date,
  ): Date {
    const base = fromDate ? new Date(fromDate) : new Date(baseDate);
    const date = new Date(base);
    const normalizedInterval = interval && interval > 0 ? interval : 1;

    switch (frequency) {
      case 'monthly':
        date.setMonth(date.getMonth() + normalizedInterval);
        return date;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3 * normalizedInterval);
        return date;
      case 'annual':
        date.setFullYear(date.getFullYear() + normalizedInterval);
        return date;
      case 'one-time':
        return date;
      default:
        throw new BadRequestException(`Unsupported frequency: ${frequency}`);
    }
  }
}
