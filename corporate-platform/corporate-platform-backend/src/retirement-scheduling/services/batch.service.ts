import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { BatchRetirementDto } from '../dto/batch-retirement.dto';
import {
  BatchExecutionResult,
  BatchRetirementItem,
} from '../interfaces/batch-job.interface';
import { ValidationService } from '../../retirement/services/validation.service';

@Injectable()
export class BatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  async createBatch(
    companyId: string,
    createdBy: string,
    dto: BatchRetirementDto,
    autoProcess = true,
  ) {
    if (!dto.items?.length) {
      throw new BadRequestException('Batch must contain at least one item');
    }

    const batch = await this.prisma.batchRetirement.create({
      data: {
        companyId,
        createdBy,
        name: dto.name,
        description: dto.description,
        items: dto.items as any,
        status: 'pending',
        totalItems: dto.items.length,
        completedItems: 0,
        failedItems: 0,
        retirementIds: [],
      },
    });

    if (autoProcess) {
      await this.processBatch(batch.id);
    }

    return this.getBatch(companyId, batch.id);
  }

  async createBatchFromCsv(
    companyId: string,
    createdBy: string,
    name: string,
    description: string | undefined,
    csvContent: string,
    autoProcess = true,
  ) {
    const items = this.parseCsv(csvContent);
    return this.createBatch(
      companyId,
      createdBy,
      {
        name,
        description,
        items,
      },
      autoProcess,
    );
  }

  async listBatches(companyId: string) {
    return this.prisma.batchRetirement.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBatch(companyId: string, id: string) {
    const batch = await this.prisma.batchRetirement.findFirst({
      where: { id, companyId },
    });

    if (!batch) {
      throw new NotFoundException('Batch job not found');
    }

    return batch;
  }

  async processBatch(id: string): Promise<BatchExecutionResult> {
    const batch = await this.prisma.batchRetirement.findUnique({ where: { id } });
    if (!batch) {
      throw new NotFoundException('Batch job not found');
    }

    const items = batch.items as unknown as BatchRetirementItem[];

    await this.prisma.batchRetirement.update({
      where: { id },
      data: { status: 'processing' },
    });

    const retirementIds: string[] = [];
    const errors: { index: number; creditId?: string; error: string }[] = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      try {
        await this.validationService.validateRetirement(
          batch.companyId,
          item.creditId,
          item.amount,
        );

        const retirement = await (this.prisma as any).$transaction(async (tx: any) => {
          await tx.credit.update({
            where: { id: item.creditId },
            data: { available: { decrement: item.amount } },
          });

          return tx.retirement.create({
            data: {
              companyId: batch.companyId,
              userId: batch.createdBy,
              creditId: item.creditId,
              amount: item.amount,
              purpose: item.purpose,
              purposeDetails: item.purposeDetails || `Batch retirement: ${batch.name}`,
              priceAtRetirement: 10,
              transactionHash: `tx_${Math.random().toString(36).slice(2, 10)}`,
              transactionUrl: 'https://stellar.expert/explorer/testnet/tx/...',
              verifiedAt: new Date(),
            },
          });
        });

        retirementIds.push(retirement.id);
      } catch (error) {
        const err = error as Error;
        errors.push({
          index: i,
          creditId: item.creditId,
          error: err.message,
        });
      }

      await this.prisma.batchRetirement.update({
        where: { id },
        data: {
          completedItems: retirementIds.length,
          failedItems: errors.length,
          retirementIds,
          errorLog: errors as any,
        },
      });
    }

    const status =
      errors.length === 0
        ? 'completed'
        : retirementIds.length > 0
          ? 'completed'
          : 'failed';

    await this.prisma.batchRetirement.update({
      where: { id },
      data: {
        status,
        retirementIds,
        completedItems: retirementIds.length,
        failedItems: errors.length,
        errorLog: errors as any,
        completedAt: new Date(),
      },
    });

    return {
      totalItems: items.length,
      completedItems: retirementIds.length,
      failedItems: errors.length,
      retirementIds,
      errors,
    };
  }

  parseCsv(csvContent: string): BatchRetirementItem[] {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new BadRequestException('CSV file is empty');
    }

    const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
    const creditIdIndex = header.indexOf('creditid');
    const amountIndex = header.indexOf('amount');
    const purposeIndex = header.indexOf('purpose');
    const purposeDetailsIndex = header.indexOf('purposedetails');

    if (creditIdIndex < 0 || amountIndex < 0 || purposeIndex < 0) {
      throw new BadRequestException(
        'CSV header must contain creditId, amount, purpose',
      );
    }

    const items: BatchRetirementItem[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const amount = Number(cols[amountIndex]);

      if (!cols[creditIdIndex] || !Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(`Invalid CSV row at line ${i + 1}`);
      }

      items.push({
        creditId: cols[creditIdIndex],
        amount,
        purpose: cols[purposeIndex],
        purposeDetails:
          purposeDetailsIndex >= 0 ? cols[purposeDetailsIndex] : undefined,
      });
    }

    return items;
  }
}
