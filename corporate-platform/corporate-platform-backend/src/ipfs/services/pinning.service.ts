import { Injectable, Logger, Inject } from '@nestjs/common';
import { IpfsConfig } from '../ipfs.config';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  IIpfsProvider,
  IPFS_PROVIDER,
} from '../interfaces/ipfs-provider.interface';
import { IpfsMetricsService } from '../metrics/ipfs-metrics.service';

@Injectable()
export class PinningService {
  private readonly logger = new Logger(PinningService.name);

  constructor(
    private readonly config: IpfsConfig,
    private readonly prisma: PrismaService,
    @Inject(IPFS_PROVIDER) private readonly provider: IIpfsProvider,
    private readonly metrics: IpfsMetricsService,
  ) {}

  async pin(cid: string) {
    try {
      const results = await this.metrics.timeOperation('pin', () =>
        this.provider.pinBatch([cid]),
      );
      const result = results[0];
      if (!result.success) {
        this.metrics.recordFailure('pin', 'provider-rejected');
        return { cid, error: 'pin-failed', details: result.error };
      }
      await this.prisma.ipfsDocument.updateMany({
        where: { ipfsCid: cid },
        data: { pinned: true, pinnedAt: new Date() },
      });
      return { cid, success: true };
    } catch (err: any) {
      this.logger.warn('pin failed', err?.message);
      this.metrics.recordFailure('pin', 'exception');
      return { cid, error: 'pin-failed', details: err?.message };
    }
  }

  async pinBatch(cids: string[]) {
    try {
      const results = await this.metrics.timeOperation('pin', () =>
        this.provider.pinBatch(cids),
      );
      for (const r of results) {
        if (r.success) {
          await this.prisma.ipfsDocument.updateMany({
            where: { ipfsCid: r.cid },
            data: { pinned: true, pinnedAt: new Date() },
          });
        } else {
          this.metrics.recordFailure('pin', 'provider-rejected');
        }
      }
      return results;
    } catch (err: any) {
      this.logger.warn('batch pin failed', err?.message);
      this.metrics.recordFailure('pin', 'exception');
      return cids.map((cid) => ({ cid, success: false, error: err?.message }));
    }
  }

  async unpin(cid: string, opts: { force?: boolean } = {}) {
    try {
      await this.metrics.timeOperation('unpin', () => this.provider.unpin(cid));
      await this.prisma.ipfsDocument.updateMany({
        where: { ipfsCid: cid },
        data: { pinned: false },
      });
      return { cid, success: true };
    } catch (err: any) {
      this.logger.warn('unpin failed', err?.message);
      this.metrics.recordFailure('unpin', 'exception');
      if (opts.force) {
        await this.prisma.ipfsDocument.updateMany({
          where: { ipfsCid: cid },
          data: { pinned: false },
        });
        return { cid, result: 'force-unpinned-in-db' };
      }
      return { cid, error: 'unpin-failed', details: err?.message };
    }
  }
}
