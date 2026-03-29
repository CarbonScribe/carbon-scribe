import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { MappingRulesService } from './mapping-rules.service';
import { CreateMappingDto, UpdateMappingDto } from '../dto/create-mapping.dto';

@Injectable()
export class MethodologyMappingService {
  private readonly logger = new Logger(MethodologyMappingService.name);

  constructor(
    private prisma: PrismaService,
    private mappingRules: MappingRulesService,
  ) {}

  async createMapping(dto: CreateMappingDto, userId: string = 'system') {
    // Check if mapping already exists
    const existing = await this.prisma.frameworkMethodologyMapping.findUnique({
      where: {
        frameworkId_methodologyId: {
          frameworkId: dto.frameworkId,
          methodologyId: dto.methodologyId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Mapping already exists for this framework and methodology',
      );
    }

    const mapping = await this.prisma.frameworkMethodologyMapping.create({
      data: {
        frameworkId: dto.frameworkId,
        methodologyId: dto.methodologyId,
        methodologyTokenId: dto.methodologyTokenId,
        requirementIds: dto.requirementIds,
        mappingType: dto.mappingType,
        mappedBy: userId,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        metadata: dto.metadata || {},
      },
    });

    // Log to audit log
    await this.logAudit('CREATE_MAPPING', mapping.id, null, mapping, userId);

    return mapping;
  }

  async getMappingsForMethodology(tokenId: number) {
    return this.prisma.frameworkMethodologyMapping.findMany({
      where: { methodologyTokenId: tokenId, isActive: true },
      include: { framework: true },
    });
  }

  async getMethodologiesForFramework(frameworkCode: string) {
    const framework = await this.prisma.framework.findUnique({
      where: { code: frameworkCode },
    });

    if (!framework) {
      throw new NotFoundException(
        `Framework with code ${frameworkCode} not found`,
      );
    }

    return this.prisma.frameworkMethodologyMapping.findMany({
      where: { frameworkId: framework.id, isActive: true },
      include: { methodology: true },
    });
  }

  async updateMapping(
    id: string,
    dto: UpdateMappingDto,
    userId: string = 'system',
  ) {
    const existing = await this.prisma.frameworkMethodologyMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Mapping with ID ${id} not found`);
    }

    const updated = await this.prisma.frameworkMethodologyMapping.update({
      where: { id },
      data: dto,
    });

    await this.logAudit('UPDATE_MAPPING', id, existing, updated, userId);

    return updated;
  }

  async deleteMapping(id: string, userId: string = 'system') {
    const existing = await this.prisma.frameworkMethodologyMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Mapping with ID ${id} not found`);
    }

    await this.prisma.frameworkMethodologyMapping.delete({
      where: { id },
    });

    await this.logAudit('DELETE_MAPPING', id, existing, null, userId);

    return { success: true };
  }

  async autoMapMethodology(methodologyId: string, userId: string = 'system') {
    const methodology = await this.prisma.syncedMethodology.findUnique({
      where: { id: methodologyId },
    });

    if (!methodology) {
      throw new NotFoundException(
        `Methodology with ID ${methodologyId} not found`,
      );
    }

    const activeRules = await this.mappingRules.findActiveRules();
    const mappingsCreated = [];

    for (const rule of activeRules) {
      let isMatch = false;

      switch (rule.conditionType) {
        case 'REGISTRY':
          isMatch =
            methodology.registry?.toLowerCase() ===
            rule.conditionValue.toLowerCase();
          break;
        case 'METHODOLOGY_TYPE':
          isMatch =
            this.inferMethodologyType(methodology).toLowerCase() ===
            rule.conditionValue.toLowerCase();
          break;
        case 'AUTHORITY':
          isMatch =
            methodology.issuingAuthority?.toLowerCase() ===
            rule.conditionValue.toLowerCase();
          break;
        case 'KEYWORD':
          isMatch =
            methodology.name
              .toLowerCase()
              .includes(rule.conditionValue.toLowerCase()) ||
            methodology.version
              ?.toLowerCase()
              .includes(rule.conditionValue.toLowerCase());
          break;
      }

      if (isMatch) {
        // Find the framework by code (assuming rule.targetFramework is framework code)
        const framework = await this.prisma.framework.findUnique({
          where: { code: rule.targetFramework },
        });

        if (framework) {
          try {
            const mapping = await this.createMapping(
              {
                frameworkId: framework.id,
                methodologyId: methodology.id,
                methodologyTokenId: methodology.tokenId,
                requirementIds: rule.targetRequirements as string[],
                mappingType: 'AUTO',
                metadata: { ruleId: rule.id, ruleName: rule.name },
              },
              userId,
            );
            mappingsCreated.push(mapping);
          } catch {
            // Mapping might already exist, skip
            this.logger.debug(
              `Auto-mapping already exists for methodology ${methodology.id} and framework ${framework.id}`,
            );
          }
        }
      }
    }

    return mappingsCreated;
  }

  private async logAudit(
    eventType: string,
    resourceId: string,
    oldValue: any,
    newValue: any,
    userId: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          eventType,
          severity: 'INFO',
          resource: `FrameworkMethodologyMapping:${resourceId}`,
          details: { resourceId },
          oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
          newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
          status: 'SUCCESS',
          userId: userId !== 'system' ? userId : null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
    }
  }

  private inferMethodologyType(methodology: {
    name: string;
    version: string;
  }): string {
    const basis = `${methodology.name} ${methodology.version}`.toLowerCase();

    if (basis.includes('forest')) {
      return 'FORESTRY';
    }

    if (basis.includes('renewable') || basis.includes('solar')) {
      return 'RENEWABLE_ENERGY';
    }

    if (basis.includes('cookstove')) {
      return 'COOKSTOVES';
    }

    if (basis.includes('methane')) {
      return 'METHANE';
    }

    return 'GENERAL';
  }
}
