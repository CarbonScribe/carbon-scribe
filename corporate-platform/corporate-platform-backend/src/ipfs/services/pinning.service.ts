import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IpfsConfig } from '../ipfs.config';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class PinningService {
  private readonly logger = new Logger(PinningService.name);
  private readonly base = 'https://api.pinata.cloud';

  constructor(
    private readonly config: IpfsConfig,
    private readonly prisma: PrismaService,
  ) {}

  async pin(cid: string) {
    try {
      const res = await axios.post(
        `${this.base}/pinning/pinByHash`,
        { hashToPin: cid },
        {
          headers: { Authorization: `Bearer ${this.config.jwt}` },
          timeout: this.config.timeout,
        },
      );
      await this.prisma.ipfsDocument.updateMany({
        where: { ipfsCid: cid },
        data: { pinned: true, pinnedAt: new Date() },
      });
      return { cid, result: res.data };
    } catch (err) {
      this.logger.warn('pin failed', err?.message);
      return { cid, error: 'pin-failed', details: err?.message };
    }
  }

  async pinBatch(cids: string[]) {
    const results = [];
    for (const c of cids) results.push(await this.pin(c));
    return results;
  }

  async unpin(cid: string, opts: { force?: boolean } = {}) {
    try {
      // Pinata unpin
      const res = await axios.delete(`${this.base}/pinning/unpin/${cid}`, {
        headers: { Authorization: `Bearer ${this.config.jwt}` },
        timeout: this.config.timeout,
      });
      await this.prisma.ipfsDocument.updateMany({
        where: { ipfsCid: cid },
        data: { pinned: false },
      });
      return { cid, result: res.data };
    } catch (err) {
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
