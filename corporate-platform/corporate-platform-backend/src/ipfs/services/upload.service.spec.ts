import { createHash } from 'crypto';
import { UploadService } from './upload.service';
import { IpfsConfig } from '../ipfs.config';

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      PINATA_API_KEY: 'test-key',
      PINATA_SECRET_KEY: 'test-secret',
      PINATA_JWT: 'test-jwt',
      PINATA_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
      IPFS_GATEWAY: 'https://ipfs.io/ipfs/',
      PINATA_TIMEOUT_MS: 20000,
    };
    return config[key] ?? defaultValue;
  }),
} as any;

jest.mock('clamscan', () => {
  return jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue({
      isInfected: jest
        .fn()
        .mockResolvedValue({ isInfected: false, viruses: [] }),
      scanBuffer: jest
        .fn()
        .mockResolvedValue({ isInfected: false, viruses: [] }),
    }),
  }));
});

describe('UploadService hash persistence', () => {
  const mockPrisma = {
    ipfsDocument: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  const mockProvider = {
    providerName: 'mock',
    pinFile: jest.fn().mockResolvedValue('cid123'),
    getContent: jest.fn(),
    unpin: jest.fn(),
    pinBatch: jest.fn(),
  } as any;

  const mockRetrieval = {
    verifyPin: jest.fn().mockResolvedValue({ verified: true, attempts: 1 }),
  } as any;

  let service: UploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UploadService(
      new IpfsConfig(mockConfigService),
      mockPrisma,
      mockProvider,
      mockRetrieval,
    );
    mockPrisma.ipfsDocument.findFirst.mockResolvedValue(null);
    mockPrisma.ipfsDocument.create.mockResolvedValue({
      id: 'doc1',
      ipfsCid: 'cid123',
    });
  });

  it('computes and persists SHA-256 contentHash for uploaded file', async () => {
    const buffer = Buffer.from('hash-me');
    const expectedHash = createHash('sha256').update(buffer).digest('hex');

    const file = {
      originalname: 'test.txt',
      buffer,
      size: buffer.length,
      mimetype: 'text/plain',
    };

    const result = await service.upload(file, {
      companyId: 'company-1',
      documentType: 'REPORT',
      referenceId: 'ref-1',
      idempotencyKey: 'idempotency-1',
    });

    expect(mockPrisma.ipfsDocument.create).toHaveBeenCalled();
    const createCall = mockPrisma.ipfsDocument.create.mock.calls[0][0];

    expect(createCall.data.contentHash).toBe(expectedHash);
    expect(result.record.contentHash).toBe(expectedHash);
  });

  it('calls verifyPin after successful pinFile', async () => {
    const buffer = Buffer.from('verify-me');
    const file = {
      originalname: 'cert.pdf',
      buffer,
      size: buffer.length,
      mimetype: 'application/pdf',
    };

    await service.upload(file, {
      companyId: 'company-1',
      documentType: 'CERTIFICATE',
      referenceId: 'ref-2',
    });

    expect(mockRetrieval.verifyPin).toHaveBeenCalledWith('cid123');
  });

  it('persists pinVerified flag in metadata when verification succeeds', async () => {
    const buffer = Buffer.from('verified-content');
    const file = {
      originalname: 'cert.pdf',
      buffer,
      size: buffer.length,
      mimetype: 'application/pdf',
    };

    await service.upload(file, {
      companyId: 'company-1',
      documentType: 'CERTIFICATE',
      referenceId: 'ref-3',
    });

    const createCall = mockPrisma.ipfsDocument.create.mock.calls[0][0];
    expect(createCall.data.metadata.pinVerified).toBe(true);
    expect(createCall.data.metadata.pinVerifyAttempts).toBe(1);
    expect(createCall.data.metadata.pinVerifiedAt).toBeDefined();
  });

  it('throws and does not persist record when pin verification fails', async () => {
    mockRetrieval.verifyPin.mockResolvedValueOnce({
      verified: false,
      attempts: 3,
      error: 'Content not retrievable from gateway after 3 attempt(s)',
    });

    const buffer = Buffer.from('unreachable-content');
    const file = {
      originalname: 'cert.pdf',
      buffer,
      size: buffer.length,
      mimetype: 'application/pdf',
    };

    await expect(
      service.upload(file, {
        companyId: 'company-1',
        documentType: 'CERTIFICATE',
        referenceId: 'ref-4',
      }),
    ).rejects.toThrow(/IPFS upload failed/);

    expect(mockPrisma.ipfsDocument.create).not.toHaveBeenCalled();
  });
});
