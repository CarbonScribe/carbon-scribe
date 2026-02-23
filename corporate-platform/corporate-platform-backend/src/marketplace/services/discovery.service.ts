import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { Credit } from '@prisma/client';
import {
  DiscoveryResponse,
  DiscoverySection,
} from '../interfaces/discovery.interface';

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async getFeatured(limit = 20): Promise<Credit[]> {
    const now = new Date();
    return this.prisma.credit.findMany({
      where: {
        featured: true,
        OR: [{ featuredUntil: null }, { featuredUntil: { gt: now } }],
        available: { gt: 0 },
      } as any,
      orderBy: [{ featuredUntil: 'desc' }, { createdAt: 'desc' }] as any,
      take: limit,
    });
  }

  async getTrending(limit = 20): Promise<Credit[]> {
    return this.prisma.credit.findMany({
      where: { available: { gt: 0 } },
      orderBy: [{ viewCount: 'desc' }, { purchaseCount: 'desc' }] as any,
      take: limit,
    });
  }

  async getNewest(limit = 20): Promise<Credit[]> {
    return this.prisma.credit.findMany({
      where: { available: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getHighestQuality(limit = 20): Promise<Credit[]> {
    return this.prisma.credit.findMany({
      where: { available: { gt: 0 }, price: { not: null } } as any,
      orderBy: { price: 'desc' } as any,
      take: limit,
    });
  }

  async getBestValue(limit = 20): Promise<Credit[]> {
    return this.prisma.credit.findMany({
      where: { available: { gt: 0 }, price: { not: null } } as any,
      orderBy: { price: 'asc' } as any,
      take: limit,
    });
  }

  async getRegionalSpotlights(
    limitPerRegion = 5,
  ): Promise<DiscoverySection<Credit>[]> {
    const credits = await this.prisma.credit.findMany({
      where: { available: { gt: 0 } },
      orderBy: [{ viewCount: 'desc' }, { purchaseCount: 'desc' }] as any,
    });

    const byCountry = new Map<string, Credit[]>();
    for (const credit of credits) {
      const country = credit.country || 'Unknown';
      if (!byCountry.has(country)) {
        byCountry.set(country, []);
      }
      const list = byCountry.get(country)!;
      if (list.length < limitPerRegion) {
        list.push(credit);
      }
    }

    return Array.from(byCountry.entries()).map(([country, items]) => ({
      title: country,
      items,
    }));
  }

  async getDiscoveryOverview(): Promise<DiscoveryResponse<Credit>> {
    const [
      featured,
      trending,
      newest,
      highestQuality,
      bestValue,
      regionalSpotlights,
    ] = await Promise.all([
      this.getFeatured(12),
      this.getTrending(12),
      this.getNewest(12),
      this.getHighestQuality(12),
      this.getBestValue(12),
      this.getRegionalSpotlights(5),
    ]);

    return {
      featured,
      trending,
      newest,
      highestQuality,
      bestValue,
      regionalSpotlights,
    };
  }
}
