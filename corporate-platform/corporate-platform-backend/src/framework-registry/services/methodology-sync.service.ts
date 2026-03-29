import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  MethodologyLibraryService,
  MethodologyMeta,
} from '../../stellar/soroban/contracts/methodology-library.service';
import { MethodologyMapperService } from './methodology-mapper.service';
import {
  MethodologyListQueryDto,
  TriggerMethodologySyncDto,
} from '../dto/methodology-sync.dto';

@Injectable()
export class MethodologySyncService {
  private readonly logger = new Logger(MethodologySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly methodologyLibraryService: MethodologyLibraryService,
    private readonly methodologyMapperService: MethodologyMapperService,
  ) {}

  async syncAllMethodologies(
    dto: TriggerMethodologySyncDto = {},
    triggeredBy = 'system',
  ) {
    const latestTokenId =
      dto.endTokenId ??
      (await this.methodologyLibraryService.getLatestTokenId());
    const startTokenId = dto.startTokenId || 1;

    if (startTokenId > latestTokenId && latestTokenId > 0) {
      throw new BadRequestException('startTokenId cannot be greater than end');
    }

    if (latestTokenId === 0) {
      return {
        startTokenId,
        endTokenId: 0,
        total: 0,
        synced: 0,
        failed: 0,
        failedTokenIds: [],
      };
    }

    const failedTokenIds: number[] = [];
    let synced = 0;

    for (let tokenId = startTokenId; tokenId <= latestTokenId; tokenId += 1) {
      try {
        await this.syncMethodologyByTokenId(tokenId, {
          syncedFromBlock: dto.syncedFromBlock,
          triggeredBy,
        });
        synced += 1;
      } catch (error) {
        failedTokenIds.push(tokenId);
        this.logger.error(
          `Methodology sync failed for token ${tokenId}: ${error.message}`,
        );
      }
    }

    return {
      startTokenId,
      endTokenId: latestTokenId,
      total: latestTokenId - startTokenId + 1,
      synced,
      failed: failedTokenIds.length,
      failedTokenIds,
    };
  }

  async syncMethodologyByTokenId(
    tokenId: number,
    options: { syncedFromBlock?: number; triggeredBy?: string } = {},
  ) {
    const metadata =
      await this.methodologyLibraryService.getMethodologyMeta(tokenId);

    if (!metadata) {
      throw new NotFoundException(
        `No methodology metadata found on contract for token ${tokenId}`,
      );
    }

    const syncedFromBlock =
      options.syncedFromBlock ??
      (await this.methodologyLibraryService.getCurrentLedgerSequence());

    const methodology = await this.upsertMethodology(
      tokenId,
      metadata,
      syncedFromBlock,
    );

    const mappings = await this.methodologyMapperService.mapMethodology(
      methodology.id,
      options.triggeredBy || 'system-sync',
    );

    return {
      methodology,
      mappingsCreated: mappings.length,
    };
  }

  async listSyncedMethodologies(query: MethodologyListQueryDto) {
    const where: any = {};

    if (query.registry) {
      where.registry = query.registry;
    }

    if (typeof query.isActive === 'boolean') {
      where.isActive = query.isActive;
    }

    const take = query.limit || 50;
    const skip = query.offset || 0;

    const [items, total] = await Promise.all([
      this.prisma.syncedMethodology.findMany({
        where,
        orderBy: { tokenId: 'asc' },
        take,
        skip,
      }),
      this.prisma.syncedMethodology.count({ where }),
    ]);

    return {
      total,
      limit: take,
      offset: skip,
      items,
    };
  }

  async getSyncedMethodology(tokenId: number) {
    const methodology = await this.prisma.syncedMethodology.findUnique({
      where: { tokenId },
      include: {
        mappings: {
          where: { isActive: true },
          include: { framework: true },
        },
      },
    });

    if (!methodology) {
      throw new NotFoundException(`Synced methodology ${tokenId} not found`);
    }

    return methodology;
  }

  async getFrameworkMethodologies(frameworkCode: string) {
    const framework = await this.prisma.framework.findUnique({
      where: { code: frameworkCode },
      include: {
        mappings: {
          where: { isActive: true },
          include: { methodology: true },
        },
      },
    });

    if (!framework) {
      throw new NotFoundException(
        `Framework with code ${frameworkCode} not found`,
      );
    }

    return framework.mappings.map((mapping) => ({
      frameworkId: framework.id,
      frameworkCode: framework.code,
      methodologyTokenId: mapping.methodologyTokenId,
      requirementIds: mapping.requirementIds,
      methodology: mapping.methodology,
    }));
  }

  private async upsertMethodology(
    tokenId: number,
    metadata: MethodologyMeta,
    syncedFromBlock: number,
  ) {
    const prisma = this.prisma as any;

    return prisma.syncedMethodology.upsert({
      where: { tokenId },
      update: {
        name: metadata.name,
        version: metadata.version,
        registry: metadata.registry,
        registryLink: metadata.registryLink,
        issuingAuthority: metadata.issuingAuthority,
        ipfsCid: metadata.ipfsCid || null,
        isActive: true,
        lastSyncedAt: new Date(),
        syncedFromBlock,
      },
      create: {
        tokenId,
        name: metadata.name,
        version: metadata.version,
        registry: metadata.registry,
        registryLink: metadata.registryLink,
        issuingAuthority: metadata.issuingAuthority,
        ipfsCid: metadata.ipfsCid || null,
        isActive: true,
        lastSyncedAt: new Date(),
        syncedFromBlock,
      },
    });
  }
}
