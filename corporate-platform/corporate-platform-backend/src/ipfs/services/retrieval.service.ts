import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';
import { IpfsService } from '../ipfs.service';
import { IpfsConfig } from '../ipfs.config';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly ipfs: IpfsService,
    private readonly config: IpfsConfig,
    private readonly prisma: PrismaService,
  ) {}

  async get(cid: string) {
    if (!this.ipfs.validateCid(cid)) return { error: 'invalid cid' };
    const url = this.ipfs.gatewayForCid(cid);
    try {
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.config.timeout,
      });

      const dataBuffer = Buffer.from(res.data);
      const computedHash = createHash('sha256')
        .update(dataBuffer)
        .digest('hex');
      const record = await this.prisma.ipfsDocument.findUnique({
        where: { ipfsCid: cid },
      });

      if (record?.contentHash && record.contentHash !== computedHash) {
        this.logger.error(
          `Integrity mismatch for CID ${cid}. stored=${record.contentHash} computed=${computedHash}`,
        );
        return {
          cid,
          url,
          error: 'integrity-check-failed',
          details: 'Stored hash does not match retrieved content hash',
          expectedHash: record.contentHash,
          actualHash: computedHash,
        };
      }

      return {
        cid,
        url,
        data: dataBuffer.toString('base64'),
        contentType: res.headers['content-type'],
        contentHash: computedHash,
        integrityVerified: !!record?.contentHash,
      };
    } catch (err) {
      return { cid, url, error: 'not-retrievable', details: err?.message };
    }
  }

  async getMetadata(cid: string) {
    // For basic implementation we return gateway url + basic results
    if (!this.ipfs.validateCid(cid)) return { error: 'invalid cid' };
    const url = this.ipfs.gatewayForCid(cid);
    return { cid, url };
  }

  async verifyPin(
    cid: string,
  ): Promise<{ verified: boolean; attempts: number; error?: string }> {
    const maxAttempts = this.config.verifyRetryAttempts;
    const delayMs = this.config.verifyRetryDelayMs;
    const timeoutMs = this.config.verifyTimeoutMs;
    const url = this.ipfs.gatewayForCid(cid);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await axios.head(url, { timeout: timeoutMs });
        this.logger.log(
          `CID ${cid} verified retrievable on attempt ${attempt}/${maxAttempts}`,
        );
        return { verified: true, attempts: attempt };
      } catch (err: any) {
        this.logger.warn(
          `Verify attempt ${attempt}/${maxAttempts} failed for CID ${cid}: ${err?.message}`,
        );
        if (attempt < maxAttempts) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    const error = `Content not retrievable from gateway after ${maxAttempts} attempt(s)`;
    this.logger.error(`Pin verification failed for CID ${cid}: ${error}`);
    return { verified: false, attempts: maxAttempts, error };
  }
}
