import { Injectable, Logger } from '@nestjs/common';
import * as FormData from 'form-data';
import axios from 'axios';
import { createReadStream } from 'fs';
import {
  IIpfsProvider,
  IpfsFile,
  IpfsContent,
  BatchPinResult,
} from '../interfaces/ipfs-provider.interface';
import { IpfsConfig } from '../ipfs.config';

/**
 * Pinata implementation of IIpfsProvider.
 * All Pinata-specific logic is isolated here; swap this class to change providers.
 */
@Injectable()
export class PinataProvider implements IIpfsProvider {
  readonly providerName = 'pinata';
  private readonly logger = new Logger(PinataProvider.name);
  private readonly base = 'https://api.pinata.cloud';

  constructor(private readonly config: IpfsConfig) {}

  private get authHeaders() {
    return { Authorization: `Bearer ${this.config.jwt}` };
  }

  async pinFile(
    file: IpfsFile,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const form = new FormData();

    if (file.path) {
      form.append('file', createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else if (file.buffer) {
      form.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else {
      throw new Error('No file data provided');
    }

    form.append(
      'pinataMetadata',
      JSON.stringify({ name: file.originalname, keyvalues: metadata }),
    );

    const res = await axios.post(
      `${this.base}/pinning/pinFileToIPFS`,
      form,
      {
        headers: { ...this.authHeaders, ...form.getHeaders() },
        timeout: this.config.timeout,
      },
    );

    return res.data.IpfsHash || res.data.cid || res.data.hash;
  }

  async getContent(cid: string): Promise<IpfsContent> {
    try {
      const url = `${this.config.gateway.replace(/\/$/, '')}/${cid}`;
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.config.timeout,
      });
      return {
        cid,
        data: Buffer.from(res.data),
        contentType: res.headers['content-type'],
      };
    } catch (err: any) {
      this.logger.error(`Failed to retrieve CID ${cid}:`, err?.message);
      return { cid, error: 'retrieval-failed', details: err?.message };
    }
  }

  async unpin(cid: string): Promise<void> {
    await axios.delete(`${this.base}/pinning/unpin/${cid}`, {
      headers: this.authHeaders,
      timeout: this.config.timeout,
    });
  }

  async pinBatch(cids: string[]): Promise<BatchPinResult[]> {
    return Promise.all(
      cids.map(async (cid) => {
        try {
          await axios.post(
            `${this.base}/pinning/pinByHash`,
            { hashToPin: cid },
            {
              headers: { ...this.authHeaders, 'Content-Type': 'application/json' },
              timeout: this.config.timeout,
            },
          );
          return { cid, success: true };
        } catch (err: any) {
          this.logger.warn(`Failed to pin CID ${cid}:`, err?.message);
          return { cid, success: false, error: err?.message };
        }
      }),
    );
  }
}
