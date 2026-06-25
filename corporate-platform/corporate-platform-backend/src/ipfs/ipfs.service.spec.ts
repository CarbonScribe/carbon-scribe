import { IpfsService } from './ipfs.service';
import { IpfsConfig } from './ipfs.config';

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, any> = {
      PINATA_API_KEY: 'test-key',
      PINATA_SECRET_KEY: 'test-secret',
      PINATA_JWT: 'test-jwt',
      PINATA_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
      IPFS_GATEWAY: 'https://ipfs.io/ipfs/',
      PINATA_TIMEOUT_MS: 20000,
    };
    return config[key];
  }),
} as any;

describe('IpfsService', () => {
  let service: IpfsService;

  beforeAll(() => {
    const config = new IpfsConfig(mockConfigService);
    service = new IpfsService(config);
  });

  it('should produce a gateway URL for a CID', () => {
    const cid = 'QmTestCid';
    const url = service.gatewayForCid(cid);
    expect(url).toContain(cid);
  });

  it('should validate cid strings', () => {
    expect(service.validateCid('abc')).toBeTruthy();
    expect(service.validateCid('')).toBeFalsy();
    expect(service.validateCid(null as any)).toBeFalsy();
  });
});
