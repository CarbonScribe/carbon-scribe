import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
} from '../interfaces/search-query.interface';
import { CacheService } from '../../cache/cache.service';
import { Credit } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async search(
    query: MarketplaceSearchQuery,
  ): Promise<MarketplaceSearchResult<Credit>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const where: any = {
      available: {
        gt: 0,
      },
    };

    if (query.query) {
      const q = query.query;
      where.OR = [
        { projectName: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
        { methodology: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (query.projectName) {
      where.projectName = {
        contains: query.projectName,
        mode: 'insensitive',
      };
    }

    if (query.country) {
      where.country = {
        equals: query.country,
        mode: 'insensitive',
      };
    }

    if (query.methodology) {
      where.methodology = {
        equals: query.methodology,
        mode: 'insensitive',
      };
    }

    if (query.standard) {
      where.standard = {
        equals: query.standard,
        mode: 'insensitive',
      };
    }

    if (query.vintageFrom || query.vintageTo) {
      where.vintageYear = {};
      if (query.vintageFrom) {
        where.vintageYear.gte = query.vintageFrom;
      }
      if (query.vintageTo) {
        where.vintageYear.lte = query.vintageTo;
      }
    }

    if (query.priceMin || query.priceMax) {
      where.price = {};
      if (query.priceMin != null) {
        where.price.gte = query.priceMin;
      }
      if (query.priceMax != null) {
        where.price.lte = query.priceMax;
      }
    }

    if (query.sdgs && query.sdgs.length > 0) {
      const tokens = query.sdgs.map((s) => String(s));
      where.AND = where.AND || [];
      for (const token of tokens) {
        where.AND.push({
          sdgs: {
            contains: token,
          },
        });
      }
    }

    const orderBy: any[] = [];
    if (query.sortBy === 'price') {
      orderBy.push({ price: query.sortOrder || 'asc' });
    } else if (query.sortBy === 'vintage') {
      orderBy.push({ vintageYear: query.sortOrder || 'desc' });
    } else if (query.sortBy === 'popularity') {
      orderBy.push({ viewCount: 'desc' }, { purchaseCount: 'desc' });
    } else if (query.sortBy === 'createdAt') {
      orderBy.push({ createdAt: query.sortOrder || 'desc' });
    } else {
      orderBy.push({ featured: 'desc' }, { createdAt: 'desc' });
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.credit.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.credit.count({ where }),
    ]);

    await this.trackSearch(query.query || '');

    const facets = await this.buildFacets(where);

    return {
      data,
      total,
      page,
      limit,
      facets,
    };
  }

  private async trackSearch(term: string) {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      return;
    }
    const key = `marketplace:search:term:${normalized}`;
    const current = await this.cacheService.get<number>(key);
    const next = (current || 0) + 1;
    await this.cacheService.set(key, next, 60 * 60 * 24 * 30);
  }

  private async buildFacets(where: any) {
    const credits = await this.prisma.credit.findMany({
      where,
      select: {
        country: true,
        methodology: true,
        standard: true,
        sdgs: true,
        vintageYear: true,
        price: true,
      },
    });

    const countValues = <T extends string | number>(
      values: (T | null | undefined)[],
    ) => {
      const map = new Map<T, number>();
      for (const v of values) {
        if (v == null) continue;
        map.set(v, (map.get(v) || 0) + 1);
      }
      return Array.from(map.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    };

    const sdgValues: number[] = [];
    for (const c of credits) {
      if (c.sdgs) {
        const parts = c.sdgs.split(',').map((p) => Number(p.trim()));
        for (const p of parts) {
          if (!Number.isNaN(p)) {
            sdgValues.push(p);
          }
        }
      }
    }

    const prices = credits
      .map((c) => c.price)
      .filter((p): p is number => p != null)
      .sort((a, b) => a - b);

    const priceStats =
      prices.length === 0
        ? { min: undefined, max: undefined, median: undefined }
        : {
            min: prices[0],
            max: prices[prices.length - 1],
            median:
              prices.length % 2 === 1
                ? prices[(prices.length - 1) / 2]
                : (prices[prices.length / 2 - 1] +
                    prices[prices.length / 2]) /
                  2,
          };

    return {
      countries: countValues(credits.map((c) => c.country || undefined)),
      methodologies: countValues(
        credits.map((c) => c.methodology || undefined),
      ),
      standards: countValues(credits.map((c) => c.standard || undefined)),
      sdgs: countValues(sdgValues),
      vintageYears: countValues(
        credits.map((c) =>
          c.vintageYear != null ? Number(c.vintageYear) : undefined,
        ),
      ),
      priceRange: priceStats,
    };
  }
}

