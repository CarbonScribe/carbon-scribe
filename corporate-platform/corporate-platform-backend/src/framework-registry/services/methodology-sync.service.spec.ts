import { MethodologySyncService } from './methodology-sync.service';

describe('MethodologySyncService', () => {
  let service: MethodologySyncService;

  const prisma = {
    syncedMethodology: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    framework: {
      findUnique: jest.fn(),
    },
  } as any;

  const methodologyLibraryService = {
    getLatestTokenId: jest.fn(),
    getMethodologyMeta: jest.fn(),
    getCurrentLedgerSequence: jest.fn(),
  } as any;

  const methodologyMapperService = {
    mapMethodology: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MethodologySyncService(
      prisma,
      methodologyLibraryService,
      methodologyMapperService,
    );
  });

  it('syncs a single methodology and maps frameworks', async () => {
    methodologyLibraryService.getMethodologyMeta.mockResolvedValue({
      name: 'Improved Forest Management',
      version: 'VM0042 v2.1',
      registry: 'VERRA',
      registryLink: 'https://verra.org/methodologies',
      issuingAuthority: 'GBJ6AUTHORITY',
      ipfsCid: 'bafybeigdyrzt',
    });
    methodologyLibraryService.getCurrentLedgerSequence.mockResolvedValue(
      987654,
    );

    prisma.syncedMethodology.upsert.mockResolvedValue({
      id: 'methodology-1',
      tokenId: 101,
    });

    methodologyMapperService.mapMethodology.mockResolvedValue([
      { id: 'mapping-1' },
      { id: 'mapping-2' },
    ]);

    const result = await service.syncMethodologyByTokenId(101, {
      triggeredBy: 'admin-user',
    });

    expect(prisma.syncedMethodology.upsert).toHaveBeenCalledTimes(1);
    expect(methodologyMapperService.mapMethodology).toHaveBeenCalledWith(
      'methodology-1',
      'admin-user',
    );
    expect(result.mappingsCreated).toBe(2);
  });

  it('performs incremental full sync across token range', async () => {
    methodologyLibraryService.getLatestTokenId.mockResolvedValue(3);

    const syncSpy = jest
      .spyOn(service, 'syncMethodologyByTokenId')
      .mockResolvedValue({
        methodology: { id: 'm' },
        mappingsCreated: 1,
      } as any);

    const result = await service.syncAllMethodologies({}, 'system-job');

    expect(syncSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      startTokenId: 1,
      endTokenId: 3,
      total: 3,
      synced: 3,
      failed: 0,
      failedTokenIds: [],
    });
  });
});
