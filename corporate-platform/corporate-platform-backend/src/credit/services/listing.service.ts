import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreditQueryDto } from '../dto/credit-query.dto';

@Injectable()
export class ListingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CreditQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.methodology) where.methodology = query.methodology;
    if (query.country) where.country = query.country;
    if (query.vintage) where.vintage = query.vintage;
    if (query.minPrice || query.maxPrice) {
      where.pricePerTon = {};
      if (query.minPrice) where.pricePerTon.gte = query.minPrice;
      if (query.maxPrice) where.pricePerTon.lte = query.maxPrice;
    }
    if (query.sdgs && query.sdgs.length) {
      where.sdgs = { hasSome: query.sdgs };
    }
    if (query.search) {
      where.projectName = { contains: query.search, mode: 'insensitive' };
    }

    const orderBy: any = {};
    if (query.sort) {
      const [field, dir] = query.sort.split('_');
      const mapped = field === 'price' ? 'pricePerTon' : field === 'score' ? 'dynamicScore' : field === 'vintage' ? 'vintage' : null;
      if (mapped) orderBy[mapped] = dir === 'desc' ? 'desc' : 'asc';
    }

    const [data, total] = await Promise.all([
      this.prisma.credit.findMany({ where, skip, take: limit, orderBy: Object.keys(orderBy).length ? orderBy : undefined }),
      this.prisma.credit.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
