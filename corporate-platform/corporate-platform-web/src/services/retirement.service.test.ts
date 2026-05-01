import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api-client';
import { retirementService } from '@/services/retirement.service';
import type { RetirementRecord, RetirementHistoryResponse } from '@/types/retirement';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const mockRecord: RetirementRecord = {
  id: 'ret-1',
  companyId: 'company-1',
  userId: 'user-1',
  creditId: 'credit-1',
  amount: 500,
  purpose: 'scope1',
  purposeDetails: null,
  priceAtRetirement: 18.5,
  retiredAt: '2026-05-01T10:00:00.000Z',
  certificateId: 'RET-2026-ABC123',
  transactionHash: 'tx_abc123',
};

const mockHistory: RetirementHistoryResponse = {
  data: [mockRecord],
  meta: { total: 1, page: 1, limit: 10 },
};

describe('RetirementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── retire ────────────────────────────────────────────────────────────────

  describe('retire()', () => {
    it('POSTs to /retirements with the correct payload', async () => {
      mockPost.mockResolvedValue({ success: true, data: mockRecord });

      const result = await retirementService.retire({
        creditId: 'credit-1',
        amount: 500,
        purpose: 'scope1',
      });

      expect(mockPost).toHaveBeenCalledWith('/retirements', {
        creditId: 'credit-1',
        amount: 500,
        purpose: 'scope1',
      });
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('ret-1');
    });

    it('normalises a raw (non-envelope) response', async () => {
      mockPost.mockResolvedValue(mockRecord as unknown as never);

      const result = await retirementService.retire({
        creditId: 'credit-1',
        amount: 100,
        purpose: 'scope2',
      });

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(500);
    });

    it('forwards API errors', async () => {
      mockPost.mockResolvedValue({
        success: false,
        error: 'Insufficient credits',
      });

      const result = await retirementService.retire({
        creditId: 'credit-1',
        amount: 99999,
        purpose: 'scope1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient credits');
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe('getHistory()', () => {
    it('GETs /retirements without query string when no params given', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockHistory });

      await retirementService.getHistory();

      expect(mockGet).toHaveBeenCalledWith('/retirements');
    });

    it('appends query string when filters are provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockHistory });

      await retirementService.getHistory({
        purpose: 'scope2',
        page: 2,
        limit: 5,
      });

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('purpose=scope2');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('limit=5');
    });

    it('returns history data on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockHistory });

      const result = await retirementService.getHistory();

      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(1);
      expect(result.data?.meta.total).toBe(1);
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById()', () => {
    it('GETs /retirements/:id', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockRecord });

      await retirementService.getById('ret-1');

      expect(mockGet).toHaveBeenCalledWith('/retirements/ret-1');
    });

    it('URL-encodes the retirement id', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockRecord });

      await retirementService.getById('ret id with spaces');

      expect(mockGet).toHaveBeenCalledWith(
        '/retirements/ret%20id%20with%20spaces',
      );
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('GETs /retirements/stats', async () => {
      const stats = {
        totalRetired: 5000,
        byPurpose: { scope1: 3000, scope2: 2000, scope3: 0, corporate: 0, events: 0, product: 0 },
        monthlyTrend: [],
      };
      mockGet.mockResolvedValue({ success: true, data: stats });

      const result = await retirementService.getStats();

      expect(mockGet).toHaveBeenCalledWith('/retirements/stats');
      expect(result.data?.totalRetired).toBe(5000);
    });
  });

  // ── validate ──────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('GETs /retirements/validate with creditId and amount', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { valid: true, availableBalance: 1000, requestedAmount: 100 },
      });

      await retirementService.validate('credit-1', 100);

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/retirements/validate?');
      expect(calledUrl).toContain('creditId=credit-1');
      expect(calledUrl).toContain('amount=100');
    });
  });

  // ── getCertificateDownloadUrl ─────────────────────────────────────────────

  describe('getCertificateDownloadUrl()', () => {
    it('returns the correct URL', () => {
      const url = retirementService.getCertificateDownloadUrl('ret-1');
      expect(url).toContain('/retirements/ret-1/certificate');
    });

    it('URL-encodes the retirement id', () => {
      const url = retirementService.getCertificateDownloadUrl('ret/special');
      expect(url).toContain('/retirements/ret%2Fspecial/certificate');
    });
  });

  // ── getEntityCertificates ─────────────────────────────────────────────────

  describe('getEntityCertificates()', () => {
    it('GETs the correct endpoint with page/limit params', async () => {
      mockGet.mockResolvedValue({ success: true, data: { data: [], meta: { total: 0, page: 1, limit: 20 } } });

      await retirementService.getEntityCertificates('company-abc', 1, 20);

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/retirements/entity/company-abc/certificates');
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=20');
    });
  });
});
