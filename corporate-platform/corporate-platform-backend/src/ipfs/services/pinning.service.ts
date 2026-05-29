import { Injectable, Logger, Inject } from '@nestjs/common';
import { IpfsConfig } from '../ipfs.config';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  IIpfsProvider,
  IPFS_PROVIDER,
} from '../interfaces/ipfs-provider.interface';

@Injectable()
export class PinningService {
  private readonly logger = new Logger(PinningService.name);

  constructor(
    private readonly config: IpfsConfig,
    private readonly prisma: PrismaService,
    @Inject(IPFS_PROVIDER) private readonly provider: IIpfsProvider,
  ) {}

  async pin(cid: string) {
    try {
      const results = await this.provider.pinBatch([cid]);
      const result = results[0];
      if (!result.success) {
        return { cid, error: 'pin-failed', details: result.error };
      }
      await this.prisma.ipfsDocument.updateMany({
        where: { ipfsCid: cid },
        data: { pinned: true, pinnedAt: new Date() },
      });
      return { cid, success: true };
    } catch (err: any) {
      this.logger.warn('pin failed', err?.message);
      return { cid, error: 'pin-failed', details: err?.message };
    }
  }

  async pinBatch(cids: string[]) {
    try {
      const results = await this.provider.pinBatch(cids);
      for (const r of results) {
        if (r.success) {
          await this.prisma.ipfsDocument.updateMany({
            where: { ipfsCid: r.cid },
            data: { pinned: true, pinnedAt: new Date() },
          });
        }
      }
      return results;
    } catch (err: any) {
      this.logger.warn('batch pin failed', err?.message);
      return cids.map((cid) => ({ cid, success: false, error: err?.message }));
    }
  }

  async unpin(cid: string, opts: { force?: boolean } = {}) {
    try {
      await this.provider.unpin(cid);
      await this.prisma.ipfsDocument.updateMany({
        where: { ipfsCid: cid },
        data: { pinned: false },
      });
      return { cid, success: true };
    } catch (err: any) {
      this.logger.warn('unpin failed', err?.message);
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
