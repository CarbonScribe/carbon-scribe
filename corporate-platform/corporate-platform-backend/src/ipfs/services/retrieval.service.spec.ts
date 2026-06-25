import axios from 'axios';
import { createHash } from 'crypto';
import { RetrievalService } from './retrieval.service';
import { IpfsConfig } from '../ipfs.config';

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

describe('RetrievalService hash verification', () => {
  const mockIpfs = {
    validateCid: jest.fn(),
    gatewayForCid: jest.fn(),
  } as any;

  const mockPrisma = {
    ipfsDocument: {
      findUnique: jest.fn(),
    },
  } as any;

  let service: RetrievalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RetrievalService(
      mockIpfs,
      new IpfsConfig(mockConfigService),
      mockPrisma,
    );
    mockIpfs.validateCid.mockReturnValue(true);
    mockIpfs.gatewayForCid.mockReturnValue(
      'https://gateway.pinata.cloud/ipfs/cid123',
    );
  });

  it('returns retrieved payload when content hash matches stored hash', async () => {
    const payload = Buffer.from('integrity-data');
    const hash = createHash('sha256').update(payload).digest('hex');

    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: payload,
      headers: { 'content-type': 'application/pdf' },
    } as any);
    mockPrisma.ipfsDocument.findUnique.mockResolvedValueOnce({
      ipfsCid: 'cid123',
      contentHash: hash,
    });

    const result = await service.get('cid123');

    expect(result.error).toBeUndefined();
    expect(result.integrityVerified).toBe(true);
    expect(result.contentHash).toBe(hash);
    expect(result.data).toBe(payload.toString('base64'));
  });

  it('flags integrity mismatch when recomputed hash differs from stored hash', async () => {
    const payload = Buffer.from('tampered-data');

    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: payload,
      headers: { 'content-type': 'application/pdf' },
    } as any);
    mockPrisma.ipfsDocument.findUnique.mockResolvedValueOnce({
      ipfsCid: 'cid123',
      contentHash: 'deadbeef',
    });

    const result = await service.get('cid123');

    expect(result.error).toBe('integrity-check-failed');
    expect(result.expectedHash).toBe('deadbeef');
    expect(result.actualHash).toBeDefined();
  });

  it('detects file corruption when original and retrieved file differ', async () => {
    const originalPayload = Buffer.from('original-file-content');
    const corruptedPayload = Buffer.from('corrupted-file-content');
    const originalHash = createHash('sha256')
      .update(originalPayload)
      .digest('hex');
    const corruptedHash = createHash('sha256')
      .update(corruptedPayload)
      .digest('hex');

    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: corruptedPayload,
      headers: { 'content-type': 'application/pdf' },
    } as any);
    mockPrisma.ipfsDocument.findUnique.mockResolvedValueOnce({
      ipfsCid: 'cid123',
      contentHash: originalHash,
    });

    const result = await service.get('cid123');

    expect(result.error).toBe('integrity-check-failed');
    expect(result.expectedHash).toBe(originalHash);
    expect(result.actualHash).toBe(corruptedHash);
    expect(result.expectedHash).not.toBe(result.actualHash);
  });

  it('allows retrieval when file lacks contentHash (backward compatibility)', async () => {
    const payload = Buffer.from('integrity-data');

    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: payload,
      headers: { 'content-type': 'application/pdf' },
    } as any);
    mockPrisma.ipfsDocument.findUnique.mockResolvedValueOnce({
      ipfsCid: 'cid123',
      contentHash: null,
    });

    const result = await service.get('cid123');

    expect(result.error).toBeUndefined();
    expect(result.integrityVerified).toBe(false);
    expect(result.data).toBe(payload.toString('base64'));
  });
});
