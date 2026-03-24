import { Injectable } from '@nestjs/common';

@Injectable()
export class IpfsConfig {
  readonly apiKey = process.env.PINATA_API_KEY || 'mock-pinata-api-key';
  readonly secretKey =
    process.env.PINATA_SECRET_KEY || 'mock-pinata-secret-key';
  readonly jwt = process.env.PINATA_JWT || 'mock-pinata-jwt';
  readonly gateway =
    process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
  readonly fallback =
    process.env.IPFS_GATEWAY_FALLBACK || 'https://ipfs.io/ipfs/';
  readonly timeout = Number(process.env.PINATA_TIMEOUT_MS || 20000);
}
