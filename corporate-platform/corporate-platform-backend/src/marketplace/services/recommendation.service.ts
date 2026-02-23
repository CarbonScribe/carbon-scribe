import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { Credit } from '@prisma/client';
import {
  MarketplaceUserProfile,
  RecommendationOptions,
} from '../interfaces/recommendation.interface';

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(
    profile: MarketplaceUserProfile,
    options: RecommendationOptions = {},
  ): Promise<Credit[]> {
    const limit = options.limit && options.limit > 0 ? options.limit : 20;

    const retirements = await this.prisma.retirement.findMany({
      where: { companyId: profile.companyId },
      include: { credit: true },
    });

    const countryScores = new Map<string, number>();
    const methodologyScores = new Map<string, number>();
    const sdgScores = new Map<number, number>();

    for (const r of retirements) {
      const credit = r.credit;
      if (credit.country) {
        countryScores.set(
          credit.country,
          (countryScores.get(credit.country) || 0) + r.amount,
        );
      }
      if (credit.methodology) {
        methodologyScores.set(
          credit.methodology,
          (methodologyScores.get(credit.methodology) || 0) + r.amount,
        );
      }
      if (credit.sdgs) {
        const parts = credit.sdgs.split(',').map((p) => Number(p.trim()));
        for (const s of parts) {
          if (!Number.isNaN(s)) {
            sdgScores.set(s, (sdgScores.get(s) || 0) + r.amount);
          }
        }
      }
    }

    const preferredCountries =
      profile.preferredCountries ||
      Array.from(countryScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([country]) => country);

    const preferredMethodologies =
      profile.preferredMethodologies ||
      Array.from(methodologyScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m]) => m);

    const preferredSdgs =
      profile.preferredSdgs ||
      Array.from(sdgScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s]) => s);

    const where: any = {
      available: { gt: 0 },
    };

    if (preferredCountries.length > 0) {
      where.country = { in: preferredCountries };
    }

    if (preferredMethodologies.length > 0) {
      where.methodology = { in: preferredMethodologies };
    }

    if (options.sdgs && options.sdgs.length > 0) {
      const tokens = options.sdgs.map((s) => String(s));
      where.AND = where.AND || [];
      for (const token of tokens) {
        where.AND.push({
          sdgs: {
            contains: token,
          },
        });
      }
    } else if (preferredSdgs.length > 0) {
      const tokens = preferredSdgs.map((s) => String(s));
      where.AND = where.AND || [];
      for (const token of tokens) {
        where.AND.push({
          sdgs: {
            contains: token,
          },
        });
      }
    }

    const credits = await this.prisma.credit.findMany({
      where: where as any,
      orderBy: [
        { featured: 'desc' },
        { purchaseCount: 'desc' },
        { viewCount: 'desc' },
      ] as any,
      take: limit * 3,
    });

    const diversified: Credit[] = [];
    const seenCountries = new Set<string>();
    const seenMethodologies = new Set<string>();

    for (const credit of credits) {
      if (diversified.length >= limit) {
        break;
      }
      const keyCountry = credit.country || '';
      const keyMethod = credit.methodology || '';
      if (seenCountries.has(keyCountry) && seenMethodologies.has(keyMethod)) {
        continue;
      }
      diversified.push(credit);
      if (keyCountry) {
        seenCountries.add(keyCountry);
      }
      if (keyMethod) {
        seenMethodologies.add(keyMethod);
      }
    }

    return diversified.length > 0 ? diversified : credits.slice(0, limit);
  }
}
