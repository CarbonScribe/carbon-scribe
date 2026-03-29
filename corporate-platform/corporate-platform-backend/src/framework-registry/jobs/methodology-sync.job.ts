import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/database/prisma.service';
import { MethodologySyncService } from '../services/methodology-sync.service';

@Injectable()
export class MethodologySyncJob {
  private readonly logger = new Logger(MethodologySyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly methodologySyncService: MethodologySyncService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async runIncrementalSync() {
    this.logger.log('Starting methodology sync job...');

    const latest = await this.prisma.syncedMethodology.findFirst({
      orderBy: { tokenId: 'desc' },
      select: { tokenId: true },
    });

    const startTokenId = (latest?.tokenId || 0) + 1;

    const result = await this.methodologySyncService.syncAllMethodologies(
      { startTokenId },
      'system-job',
    );

    this.logger.log(
      `Methodology sync completed: synced=${result.synced}, failed=${result.failed}, range=${result.startTokenId}-${result.endTokenId}`,
    );
  }
}
