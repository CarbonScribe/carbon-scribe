import { IpfsService } from './ipfs.service';
import { IpfsConfig } from './ipfs.config';

describe('IpfsService', () => {
  let service: IpfsService;

  beforeAll(() => {
    const config = new IpfsConfig();
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
