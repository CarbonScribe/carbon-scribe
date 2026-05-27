import axios from 'axios';
import { createHash } from 'crypto';
import { UploadService } from './upload.service';
import { IpfsConfig } from '../ipfs.config';

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

  let service: UploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UploadService(new IpfsConfig(), mockPrisma);
    mockPrisma.ipfsDocument.findFirst.mockResolvedValue(null);
    mockPrisma.ipfsDocument.create.mockResolvedValue({
      id: 'doc1',
      ipfsCid: 'cid123',
    });
  });

  it('computes and persists SHA-256 contentHash for uploaded file', async () => {
    const buffer = Buffer.from('hash-me');
    const expectedHash = createHash('sha256').update(buffer).digest('hex');

    jest
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { IpfsHash: 'cid123' } } as any);

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

    // Verify contentHash is passed directly to create
    expect(createCall.data.contentHash).toBe(expectedHash);

    // Verify the result includes the hash
    expect(result.record.contentHash).toBe(expectedHash);
  });
});
