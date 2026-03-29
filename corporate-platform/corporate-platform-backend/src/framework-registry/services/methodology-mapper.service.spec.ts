import { MethodologyMapperService } from './methodology-mapper.service';

describe('MethodologyMapperService', () => {
  let service: MethodologyMapperService;

  const prisma = {
    syncedMethodology: {
      findUnique: jest.fn(),
    },
    framework: {
      findMany: jest.fn(),
    },
    frameworkMethodologyMapping: {
      upsert: jest.fn(),
    },
  } as any;

  const mappingRulesService = {
    findActiveRules: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MethodologyMapperService(prisma, mappingRulesService);
  });

  it('maps methodology to framework when rules match', async () => {
    prisma.syncedMethodology.findUnique.mockResolvedValue({
      id: 'methodology-1',
      tokenId: 7,
      name: 'Improved Forest Management',
      version: 'VM0042 v2.1',
      registry: 'VERRA',
      registryLink: 'https://registry.example',
      issuingAuthority: 'GCAUTHORITY',
    });

    prisma.framework.findMany.mockResolvedValue([{ id: 'fw-1', code: 'CSRD' }]);

    mappingRulesService.findActiveRules.mockResolvedValue([
      {
        id: 'rule-1',
        name: 'Map VERRA to CSRD',
        conditionType: 'REGISTRY',
        conditionValue: 'VERRA',
        targetFramework: 'CSRD',
        targetRequirements: ['E1-1', 'E1-2'],
      },
      {
        id: 'rule-2',
        name: 'Authority mismatch',
        conditionType: 'AUTHORITY',
        conditionValue: 'OTHER_AUTHORITY',
        targetFramework: 'CSRD',
        targetRequirements: ['E1-3'],
      },
    ]);

    prisma.frameworkMethodologyMapping.upsert.mockResolvedValue({
      id: 'mapping-1',
      frameworkId: 'fw-1',
      methodologyId: 'methodology-1',
    });

    const result = await service.mapMethodology('methodology-1', 'system-sync');

    expect(prisma.frameworkMethodologyMapping.upsert).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mapping-1');
  });
});
