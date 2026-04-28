import { Injectable, NotFoundException } from '@nestjs/common';
import { EmissionFactor } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { EmissionFactorsQueryDto } from '../dto/inventory-query.dto';
import { EmissionFactorLookup } from '../interfaces/emission-factor.interface';

@Injectable()
export class EmissionFactorsService {
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly factorCache = new Map<
    string,
    { expiresAt: number; factor: EmissionFactor }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async listFactors(query: EmissionFactorsQueryDto) {
    const where: Record<string, unknown> = { isActive: true };

    if (query.activityType) {
      where.activityType = query.activityType.toUpperCase();
    }

    if (query.region) {
      where.region = query.region.toUpperCase();
    }

    if (query.source) {
      where.source = query.source.toUpperCase();
    }

    if (query.unit) {
      where.unit = query.unit;
    }

    if (query.asOfDate) {
      const asOfDate = new Date(query.asOfDate);
      where.validFrom = { lte: asOfDate };
      where.OR = [{ validTo: null }, { validTo: { gte: asOfDate } }];
    }

    return this.prisma.emissionFactor.findMany({
      where,
      orderBy: [{ activityType: 'asc' }, { validFrom: 'desc' }],
    });
  }

  async resolveFactor(lookup: EmissionFactorLookup): Promise<EmissionFactor> {
    const normalizedLookup = {
      ...lookup,
      activityType: lookup.activityType.toUpperCase(),
      region: (lookup.region || 'GLOBAL').toUpperCase(),
      preferredSource: lookup.preferredSource?.toUpperCase(),
    };
    const cacheKey = this.buildCacheKey(normalizedLookup);
    const cached = this.factorCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.factor;
    }

    const factor =
      (await this.findFactor(
        normalizedLookup,
        normalizedLookup.preferredSource,
      )) ||
      (normalizedLookup.preferredSource
        ? await this.findFactor(normalizedLookup)
        : null);

    if (!factor) {
      throw new NotFoundException(
        `No emission factor found for ${normalizedLookup.activityType} (${normalizedLookup.unit}) in ${normalizedLookup.region}`,
      );
    }

    this.factorCache.set(cacheKey, {
      factor,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return factor;
  }

  private async findFactor(
    lookup: EmissionFactorLookup,
    source?: string,
  ): Promise<EmissionFactor | null> {
    const candidates = await this.prisma.emissionFactor.findMany({
      where: {
        activityType: lookup.activityType.toUpperCase(),
        unit: lookup.unit,
        region: { in: [(lookup.region || 'GLOBAL').toUpperCase(), 'GLOBAL'] },
        source,
        isActive: true,
        validFrom: { lte: lookup.asOfDate },
        OR: [{ validTo: null }, { validTo: { gte: lookup.asOfDate } }],
      },
      orderBy: [{ validFrom: 'desc' }],
    });

    const exactRegion = candidates.find(
      (factor) => factor.region === (lookup.region || 'GLOBAL').toUpperCase(),
    );

    return exactRegion || candidates[0] || null;
  }

  private buildCacheKey(lookup: EmissionFactorLookup) {
    return [
      lookup.activityType.toUpperCase(),
      lookup.unit,
      (lookup.region || 'GLOBAL').toUpperCase(),
      lookup.preferredSource?.toUpperCase() || 'ANY',
      lookup.asOfDate.toISOString().slice(0, 10),
    ].join(':');
  }
}
