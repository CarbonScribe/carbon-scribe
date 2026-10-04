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
      findMany: jest.fn(),
      count: jest.fn(),
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

  describe('listDocuments', () => {
    it('applies default pagination when no params are provided', async () => {
      const mockDocs = [{ id: 'doc-1' }, { id: 'doc-2' }];
      mockPrisma.ipfsDocument.findMany.mockResolvedValue(mockDocs);
      mockPrisma.ipfsDocument.count.mockResolvedValue(2);

      const result = await service.listDocuments('company-1');

      expect(mockPrisma.ipfsDocument.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.ipfsDocument.count).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
      });
      expect(result).toEqual({
        documents: mockDocs,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
      });
    });

    it('handles custom page and limit with correct skip and take', async () => {
      const mockDocs = [{ id: 'doc-11' }];
      mockPrisma.ipfsDocument.findMany.mockResolvedValue(mockDocs);
      mockPrisma.ipfsDocument.count.mockResolvedValue(25);

      const result = await service.listDocuments('company-1', {
        page: 2,
        limit: 10,
      });

      expect(mockPrisma.ipfsDocument.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('clamps limit to MAX_PAGE_LIMIT when limit exceeds 100', async () => {
      mockPrisma.ipfsDocument.findMany.mockResolvedValue([]);
      mockPrisma.ipfsDocument.count.mockResolvedValue(0);

      const result = await service.listDocuments('company-1', {
        page: 1,
        limit: 500,
      });

      expect(mockPrisma.ipfsDocument.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        skip: 0,
        take: 100,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.limit).toBe(100);
    });

    it('defaults to page 1 and default limit when invalid or zero values are passed', async () => {
      mockPrisma.ipfsDocument.findMany.mockResolvedValue([]);
      mockPrisma.ipfsDocument.count.mockResolvedValue(0);

      const result = await service.listDocuments('company-1', {
        page: -5,
        limit: 0,
      });

      expect(mockPrisma.ipfsDocument.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});

