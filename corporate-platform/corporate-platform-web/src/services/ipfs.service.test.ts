import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api-client';
import { ipfsService } from '@/services/ipfs.service';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

describe('IpfsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists documents with company scope', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });

    await ipfsService.listDocuments('company-1');

    expect(mockGet).toHaveBeenCalledWith('/ipfs/documents?companyId=company-1');
  });

  it('gets documents by reference id', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });

    await ipfsService.getDocumentsByReference('retirement-1');

    expect(mockGet).toHaveBeenCalledWith('/ipfs/documents/retirement-1');
  });

  it('retrieves CID and metadata', async () => {
    mockGet.mockResolvedValue({ success: true, data: { cid: 'Qm123', url: 'http://gateway/Qm123' } });

    await ipfsService.getByCid('Qm123');
    await ipfsService.getMetadata('Qm123');

    expect(mockGet).toHaveBeenCalledWith('/ipfs/Qm123');
    expect(mockGet).toHaveBeenCalledWith('/ipfs/Qm123/metadata');
  });

  it('supports batch upload and pin', async () => {
    mockPost.mockResolvedValue({ success: true, data: [] });

    await ipfsService.batchUpload({ files: [{ fileName: 'x.txt', content: 'eA==' }] });
    await ipfsService.batchPin(['Qm1', 'Qm2']);

    expect(mockPost).toHaveBeenCalledWith('/ipfs/batch/upload', {
      files: [{ fileName: 'x.txt', content: 'eA==' }],
    });
    expect(mockPost).toHaveBeenCalledWith('/ipfs/batch/pin', { cids: ['Qm1', 'Qm2'] });
  });

  it('anchors and verifies certificates', async () => {
    mockPost.mockResolvedValue({ success: true, data: { cid: 'QmCert', attached: true } });
    mockGet.mockResolvedValue({ success: true, data: { cid: 'QmCert', verified: true } });

    await ipfsService.anchorCertificate('retirement-1', { cid: 'QmCert' });
    await ipfsService.verifyCertificate('QmCert');

    expect(mockPost).toHaveBeenCalledWith('/ipfs/certificate/retirement-1', { cid: 'QmCert' });
    expect(mockGet).toHaveBeenCalledWith('/ipfs/certificate/QmCert/verify');
  });

  it('deletes by cid', async () => {
    mockDelete.mockResolvedValue({ success: true, data: { deleted: true } });

    await ipfsService.deleteByCid('QmDel');

    expect(mockDelete).toHaveBeenCalledWith('/ipfs/QmDel');
  });

  it('normalizes raw API payloads', async () => {
    mockGet.mockResolvedValue({ cid: 'QmRaw', url: 'u' } as unknown as never);

    const result = await ipfsService.getMetadata('QmRaw');

    expect(result.success).toBe(true);
    expect(result.data?.cid).toBe('QmRaw');
  });

  it('uploadDocument handles fetch errors', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('network fail')) as any;

    const file = new File(['content'], 'x.txt', { type: 'text/plain' });
    const result = await ipfsService.uploadDocument(file, { companyId: 'c1' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('network fail');

    global.fetch = originalFetch;
  });
});
