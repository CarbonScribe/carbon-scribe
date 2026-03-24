import { Injectable, Logger } from '@nestjs/common';
import { IpfsConfig } from './ipfs.config';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  constructor(private readonly config: IpfsConfig) {}

  gatewayForCid(cid: string) {
    const gateway =
      process.env.PINATA_GATEWAY ||
      process.env.IPFS_GATEWAY_FALLBACK ||
      this.config.gateway;
    return `${gateway.replace(/\/$/, '')}/${cid}`;
  }

  validateCid(cid: string) {
    return typeof cid === 'string' && cid.length > 0;
  }
}
