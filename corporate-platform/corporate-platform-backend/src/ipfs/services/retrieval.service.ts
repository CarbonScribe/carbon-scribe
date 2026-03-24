import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { IpfsService } from '../ipfs.service';
import { IpfsConfig } from '../ipfs.config';

@Injectable()
export class RetrievalService {
  constructor(
    private readonly ipfs: IpfsService,
    private readonly config: IpfsConfig,
  ) {}

  async get(cid: string) {
    if (!this.ipfs.validateCid(cid)) return { error: 'invalid cid' };
    const url = this.ipfs.gatewayForCid(cid);
    try {
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.config.timeout,
      });
      return {
        cid,
        url,
        data: Buffer.from(res.data).toString('base64'),
        contentType: res.headers['content-type'],
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
}
