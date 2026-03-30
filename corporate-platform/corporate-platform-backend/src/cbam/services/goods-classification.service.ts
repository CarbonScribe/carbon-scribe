import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CbamGood, CbamGoodsFilter, CbamSectorType } from '../interfaces/cbam-goods.interface';

@Injectable()
export class GoodsClassificationService {
  private readonly cbamSectors: Record<CbamSectorType, { code: string; name: string; description: string }> = {
    CEMENT: {
      code: 'CEMENT',
      name: 'Cement',
      description: 'Cement clinker and other hydraulic cements',
    },
    IRON_STEEL: {
      code: 'IRON_STEEL',
      name: 'Iron & Steel',
      description: 'Iron and steel products including pig iron, sponge iron, and steel products',
    },
    ALUMINIUM: {
      code: 'ALUMINIUM',
      name: 'Aluminium',
      description: 'Aluminium and aluminium articles',
    },
    FERTILIZERS: {
      code: 'FERTILIZERS',
      name: 'Fertilizers',
      description: 'Nitrogen, phosphate, and potash fertilizers',
    },
    ELECTRICITY: {
      code: 'ELECTRICITY',
      name: 'Electricity',
      description: 'Electrical energy',
    },
    HYDROGEN: {
      code: 'HYDROGEN',
      name: 'Hydrogen',
      description: 'Hydrogen and compounds thereof',
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  async getCbamSectors() {
    return Object.values(this.cbamSectors);
  }

  async getSectorInfo(sector: CbamSectorType) {
    return this.cbamSectors[sector];
  }

  async listGoods(companyId: string, filter?: CbamGoodsFilter): Promise<CbamGood[]> {
    const where: any = {};

    if (filter?.sector) {
      where.sector = filter.sector;
    }

    if (filter?.cnCode) {
      where.cnCode = { contains: filter.cnCode };
    }

    const goods = await this.prisma.cbamGoods.findMany({
      where,
      orderBy: { cnCode: 'asc' },
    });

    // Type assertion: Prisma returns compatible types
    return goods as unknown as CbamGood[];
  }

  async getGoodById(id: string, companyId: string): Promise<CbamGood> {
    const good = await this.prisma.cbamGoods.findUnique({
      where: { id, companyId },
    });

    if (!good) {
      throw new NotFoundException(`CBAM good with ID ${id} not found`);
    }

    // Type assertion: Prisma returns compatible types
    return good as unknown as CbamGood;
  }

  async createGood(companyId: string, data: Partial<CbamGood>): Promise<CbamGood> {
    const good = await this.prisma.cbamGoods.create({
      data: {
        companyId,
        cnCode: data.cnCode!,
        goodsName: data.goodsName!,
        sector: data.sector!,
        defaultValue: data.defaultValue,
        unit: data.unit || 'tCO2e/tonne',
      },
    });

    // Type assertion: Prisma returns compatible types
    return good as unknown as CbamGood;
  }

  async updateGood(id: string, companyId: string, data: Partial<CbamGood>): Promise<CbamGood> {
    await this.getGoodById(id, companyId);

    const good = await this.prisma.cbamGoods.update({
      where: { id, companyId },
      data: {
        cnCode: data.cnCode,
        goodsName: data.goodsName,
        sector: data.sector,
        defaultValue: data.defaultValue,
        unit: data.unit,
      },
    });

    // Type assertion: Prisma returns compatible types
    return good as unknown as CbamGood;
  }

  async deleteGood(id: string, companyId: string): Promise<void> {
    await this.getGoodById(id, companyId);
    await this.prisma.cbamGoods.delete({
      where: { id, companyId },
    });
  }

  getDefaultEmissionFactor(sector: CbamSectorType): number {
    // Default emission factors based on CBAM methodology (tCO2e per tonne)
    const defaultFactors: Record<CbamSectorType, number> = {
      CEMENT: 0.94,
      IRON_STEEL: 1.85,
      ALUMINIUM: 8.5,
      FERTILIZERS: 2.2,
      ELECTRICITY: 0.4, // tCO2e/MWh
      HYDROGEN: 10.5,
    };

    return defaultFactors[sector] || 0;
  }
}
