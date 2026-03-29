import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { MappingRulesService } from './mapping-rules.service';

@Injectable()
export class MethodologyMapperService {
  private readonly logger = new Logger(MethodologyMapperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mappingRulesService: MappingRulesService,
  ) {}

  async mapMethodology(methodologyId: string, mappedBy = 'system-sync') {
    const methodology = await this.prisma.syncedMethodology.findUnique({
      where: { id: methodologyId },
    });

    if (!methodology) {
      return [];
    }

    const rules = await this.mappingRulesService.findActiveRules();
    const frameworkByCode = new Map(
      (
        await this.prisma.framework.findMany({
          select: { id: true, code: true },
        })
      ).map((framework) => [framework.code, framework.id]),
    );

    const mappings: any[] = [];

    for (const rule of rules) {
      if (!this.matchesRule(methodology, rule)) {
        continue;
      }

      const frameworkId = frameworkByCode.get(rule.targetFramework);
      if (!frameworkId) {
        this.logger.debug(
          `Skipping rule ${rule.id}: framework ${rule.targetFramework} not found`,
        );
        continue;
      }

      const mapping = await this.prisma.frameworkMethodologyMapping.upsert({
        where: {
          frameworkId_methodologyId: {
            frameworkId,
            methodologyId,
          },
        },
        update: {
          requirementIds: [...new Set(rule.targetRequirements as string[])],
          methodologyTokenId: methodology.tokenId,
          mappedBy,
          mappedAt: new Date(),
          mappingType: 'SYSTEM',
          isActive: true,
          metadata: {
            source: 'methodology-sync',
            ruleId: rule.id,
            ruleName: rule.name,
          },
        },
        create: {
          frameworkId,
          methodologyId,
          methodologyTokenId: methodology.tokenId,
          requirementIds: [...new Set(rule.targetRequirements as string[])],
          mappedBy,
          mappingType: 'SYSTEM',
          isActive: true,
          metadata: {
            source: 'methodology-sync',
            ruleId: rule.id,
            ruleName: rule.name,
          },
        },
      });

      mappings.push(mapping);
    }

    return mappings;
  }

  private matchesRule(methodology: any, rule: any): boolean {
    const condition = rule.conditionValue.toLowerCase();

    switch (rule.conditionType) {
      case 'REGISTRY':
        return methodology.registry.toLowerCase() === condition;
      case 'AUTHORITY':
        return methodology.issuingAuthority.toLowerCase() === condition;
      case 'METHODOLOGY_TYPE':
        return (
          this.inferMethodologyType(methodology).toLowerCase() === condition
        );
      case 'KEYWORD': {
        const haystack = [
          methodology.name,
          methodology.version,
          methodology.registry,
          methodology.registryLink,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(condition);
      }
      default:
        return false;
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
