import { Injectable } from '@nestjs/common';
import { EmissionRecord } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { InventoryQueryDto, TrendsQueryDto } from '../dto/inventory-query.dto';
import {
  EmissionsInventory,
  FrameworkValidationSummary,
  InventoryCategoryBreakdown,
  InventoryTrendPoint,
} from '../interfaces/inventory.interface';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventory(
    companyId: string,
    query: InventoryQueryDto,
    frameworkValidation?: FrameworkValidationSummary,
  ): Promise<EmissionsInventory> {
    const { start, end } = this.resolvePeriod(query);
    const where = this.buildWhere(companyId, query, start, end);
    const records = await this.prisma.emissionRecord.findMany({
      where,
      include: { source: true },
      orderBy: [{ periodStart: 'asc' }],
    });

    return this.buildInventory(
      companyId,
      start,
      end,
      records,
      frameworkValidation,
    );
  }

  async getAnnualInventory(
    companyId: string,
    year: number,
    frameworkValidation?: FrameworkValidationSummary,
  ) {
    return this.getInventory(companyId, { year }, frameworkValidation);
  }

  async getTrends(
    companyId: string,
    query: TrendsQueryDto,
  ): Promise<InventoryTrendPoint[]> {
    const months = query.months || 12;
    const now = new Date();
    const end = query.year
      ? new Date(Date.UTC(query.year + 1, 0, 1))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const start = query.year
      ? new Date(Date.UTC(query.year, 0, 1))
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));

    const records = await this.prisma.emissionRecord.findMany({
      where: {
        companyId,
        periodStart: { gte: start },
        periodEnd: { lt: end },
      },
      include: { source: true },
      orderBy: [{ periodStart: 'asc' }],
    });

    const buckets = new Map<string, InventoryTrendPoint>();

    for (const record of records) {
      const date = new Date(record.periodStart);
      const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const current =
        buckets.get(period) ||
        ({
          period,
          totalCo2e: 0,
          scope1: 0,
          scope2: 0,
          scope3: 0,
        } as InventoryTrendPoint);
      current.totalCo2e = Number((current.totalCo2e + record.co2e).toFixed(6));
      if (record.source.scope === 1)
        current.scope1 = Number((current.scope1 + record.co2e).toFixed(6));
      if (record.source.scope === 2)
        current.scope2 = Number((current.scope2 + record.co2e).toFixed(6));
      if (record.source.scope === 3)
        current.scope3 = Number((current.scope3 + record.co2e).toFixed(6));
      buckets.set(period, current);
    }

    return Array.from(buckets.values()).sort((left, right) =>
      left.period.localeCompare(right.period),
    );
  }

  private resolvePeriod(query: InventoryQueryDto) {
    if (query.year) {
      return {
        start: new Date(Date.UTC(query.year, 0, 1)),
        end: new Date(Date.UTC(query.year + 1, 0, 1)),
      };
    }

    const start = query.startDate
      ? new Date(query.startDate)
      : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const end = query.endDate
      ? new Date(query.endDate)
      : new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));

    return { start, end };
  }

  private buildWhere(
    companyId: string,
    query: InventoryQueryDto,
    start: Date,
    end: Date,
  ) {
    const where: Record<string, unknown> = {
      companyId,
      periodStart: { gte: start },
      periodEnd: { lt: end },
    };

    if (typeof query.verified === 'boolean') {
      where.verified = query.verified;
    }

    if (query.scope) {
      where.source = { scope: query.scope };
    }

    return where;
  }

  private buildInventory(
    companyId: string,
    start: Date,
    end: Date,
    records: Array<
      EmissionRecord & { source: { scope: number; category: string } }
    >,
    frameworkValidation?: FrameworkValidationSummary,
  ): EmissionsInventory {
    const categoryMap = new Map<string, InventoryCategoryBreakdown>();
    const totalsByScope = {
      scope1: 0,
      scope2: 0,
      scope3: 0,
    };

    let totalCo2e = 0;
    let verifiedCo2e = 0;

    for (const record of records) {
      totalCo2e += record.co2e;
      if (record.verified) {
        verifiedCo2e += record.co2e;
      }

      if (record.source.scope === 1) totalsByScope.scope1 += record.co2e;
      if (record.source.scope === 2) totalsByScope.scope2 += record.co2e;
      if (record.source.scope === 3) totalsByScope.scope3 += record.co2e;

      const key = `${record.source.scope}:${record.source.category}`;
      const current =
        categoryMap.get(key) ||
        ({
          scope: record.source.scope,
          category: record.source.category,
          totalCo2e: 0,
          verifiedCo2e: 0,
          recordCount: 0,
        } as InventoryCategoryBreakdown);
      current.totalCo2e = Number((current.totalCo2e + record.co2e).toFixed(6));
      current.recordCount += 1;
      if (record.verified) {
        current.verifiedCo2e = Number(
          (current.verifiedCo2e + record.co2e).toFixed(6),
        );
      }
      categoryMap.set(key, current);
    }

    return {
      companyId,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalCo2e: Number(totalCo2e.toFixed(6)),
      verifiedCo2e: Number(verifiedCo2e.toFixed(6)),
      unverifiedCo2e: Number((totalCo2e - verifiedCo2e).toFixed(6)),
      recordCount: records.length,
      totalsByScope: {
        scope1: Number(totalsByScope.scope1.toFixed(6)),
        scope2: Number(totalsByScope.scope2.toFixed(6)),
        scope3: Number(totalsByScope.scope3.toFixed(6)),
      },
      categories: Array.from(categoryMap.values()).sort((left, right) => {
        if (left.scope !== right.scope) {
          return left.scope - right.scope;
        }
        return left.category.localeCompare(right.category);
      }),
      frameworkValidation,
    };
  }
}
