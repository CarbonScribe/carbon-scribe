import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

export interface MarketplaceStats {
  totalCredits: number;
  avgPrice?: number;
  projectCount: number;
  countryCount: number;
  methodologyCount: number;
  price: {
    min?: number;
    max?: number;
    median?: number;
  };
}

export interface MarketplaceFilters {
  methodologies: string[];
  countries: string[];
  sdgs: number[];
  vintageRange: {
    min?: number;
    max?: number;
  };
  priceRange: {
    min?: number;
    max?: number;
  };
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<MarketplaceStats> {
    const credits = await this.prisma.credit.findMany({
      where: { available: { gt: 0 } },
      select: {
        totalAmount: true,
        available: true,
        country: true,
        methodology: true,
        price: true,
      },
    });

    const totalCredits = credits.reduce((sum, c) => sum + c.available, 0);
    const projectCount = credits.length;

    const countries = new Set<string>();
    const methodologies = new Set<string>();
    const prices: number[] = [];

    for (const c of credits) {
      if (c.country) {
        countries.add(c.country);
      }
      if (c.methodology) {
        methodologies.add(c.methodology);
      }
      if (c.price != null) {
        prices.push(c.price);
      }
    }

    prices.sort((a, b) => a - b);

    const avgPrice =
      prices.length === 0
        ? undefined
        : prices.reduce((sum, p) => sum + p, 0) / prices.length;

    const priceStats =
      prices.length === 0
        ? { min: undefined, max: undefined, median: undefined }
        : {
            min: prices[0],
            max: prices[prices.length - 1],
            median:
              prices.length % 2 === 1
                ? prices[(prices.length - 1) / 2]
                : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) /
                  2,
          };

    return {
      totalCredits,
      avgPrice,
      projectCount,
      countryCount: countries.size,
      methodologyCount: methodologies.size,
      price: priceStats,
    };
  }

  async getFilters(): Promise<MarketplaceFilters> {
    const credits = await this.prisma.credit.findMany({
      where: { available: { gt: 0 } },
      select: {
        country: true,
        methodology: true,
        sdgs: true,
        vintageYear: true,
        price: true,
      },
    });

    const countries = new Set<string>();
    const methodologies = new Set<string>();
    const sdgsSet = new Set<number>();
    const vintageYears: number[] = [];
    const prices: number[] = [];

    for (const c of credits) {
      if (c.country) {
        countries.add(c.country);
      }
      if (c.methodology) {
        methodologies.add(c.methodology);
      }
      if (c.sdgs) {
        const parts = c.sdgs.split(',').map((p) => Number(p.trim()));
        for (const p of parts) {
          if (!Number.isNaN(p)) {
            sdgsSet.add(p);
          }
        }
      }
      if (c.vintageYear != null) {
        vintageYears.push(c.vintageYear);
      }
      if (c.price != null) {
        prices.push(c.price);
      }
    }

    vintageYears.sort((a, b) => a - b);
    prices.sort((a, b) => a - b);

    return {
      methodologies: Array.from(methodologies).sort(),
      countries: Array.from(countries).sort(),
      sdgs: Array.from(sdgsSet).sort((a, b) => a - b),
      vintageRange: {
        min: vintageYears[0],
        max: vintageYears[vintageYears.length - 1],
      },
      priceRange: {
        min: prices[0],
        max: prices[prices.length - 1],
      },
    };
  }
}
