import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  CreateMappingRuleDto,
  UpdateMappingRuleDto,
} from '../dto/create-rule.dto';

@Injectable()
export class MappingRulesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMappingRuleDto) {
    return this.prisma.mappingRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        conditionType: dto.conditionType,
        conditionValue: dto.conditionValue,
        targetFramework: dto.targetFramework,
        targetRequirements: dto.targetRequirements,
        priority: dto.priority || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async findAll() {
    return this.prisma.mappingRule.findMany({
      orderBy: { priority: 'desc' },
    });
  }

  async findActiveRules() {
    return this.prisma.mappingRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  async update(id: string, dto: UpdateMappingRuleDto) {
    const rule = await this.prisma.mappingRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Mapping rule with ID ${id} not found`);
    }

    return this.prisma.mappingRule.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const rule = await this.prisma.mappingRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Mapping rule with ID ${id} not found`);
    }

    return this.prisma.mappingRule.delete({ where: { id } });
  }
}
