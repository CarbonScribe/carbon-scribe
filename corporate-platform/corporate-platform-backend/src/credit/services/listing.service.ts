import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreditQueryDto } from '../dto/credit-query.dto';

@Injectable()
export class ListingService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: CreditQueryDto) {
    const {
      page = 1,
      limit = 10,
      methodology,
      country,
      minPrice,
      maxPrice,
      vintage,
      sdgs,
      search,
      sortBy = 'score',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (methodology) {
      where.methodology = methodology;
    }

    if (country) {
      where.country = country;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.pricePerTon = {};
      if (minPrice !== undefined) where.pricePerTon.gte = minPrice;
      if (maxPrice !== undefined) where.pricePerTon.lte = maxPrice;
    }

    if (vintage) {
      where.vintage = vintage;
    }

    if (sdgs && sdgs.length > 0) {
      where.sdgs = { hasSome: sdgs };
    }

    if (search) {
      where.OR = [
        { projectName: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { project: { description: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: any = {};
    if (sortBy === 'score') {
      orderBy.dynamicScore = sortOrder;
    } else if (sortBy === 'price') {
      orderBy.pricePerTon = sortOrder;
    } else if (sortBy === 'vintage') {
      orderBy.vintage = sortOrder;
    } else if (sortBy === 'availability') {
      orderBy.availableAmount = sortOrder;
    }

    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          project: true,
        },
      }),
      this.prisma.credit.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getFilters() {
    const [methodologies, countries, vintages] = await Promise.all([
      this.prisma.credit.findMany({
        select: { methodology: true },
        distinct: ['methodology'],
      }),
      this.prisma.credit.findMany({
        select: { country: true },
        distinct: ['country'],
      }),
      this.prisma.credit.findMany({
        select: { vintage: true },
        distinct: ['vintage'],
      }),
    ]);

    return {
      methodologies: methodologies.map((m) => m.methodology),
      countries: countries.map((c) => c.country),
      vintages: vintages.map((v) => v.vintage),
    };
  }
}
