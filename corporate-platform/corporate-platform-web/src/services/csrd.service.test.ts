import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/api-client';
import { csrdService } from '@/services/csrd.service';
import type {
  MaterialityAssessmentResult,
  Disclosure,
  CsrdReport,
  CsrdReadiness,
} from '@/types/csrd';

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockMaterialityResult: MaterialityAssessmentResult = {
  topics: [],
  materialTopics: [],
  overallSummary: 'No significant materiality gaps.',
  thresholds: { impact: 3, financial: 3 },
  coverageByCategory: { environmental: 0.8, social: 0.6, governance: 0.9 },
};

const mockDisclosure: Disclosure = {
  id: 'disc-1',
  companyId: 'company-1',
  reportingPeriod: '2024',
  standard: 'ESRS E1',
  disclosureRequirement: 'E1-6',
  dataPoint: 'Scope 1 Emissions',
  value: 125000,
  assuranceLevel: 'LIMITED',
  assuredBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockReport: CsrdReport = {
  id: 'report-1',
  companyId: 'company-1',
  reportingYear: 2024,
  status: 'REVIEW',
  metadata: {
    isExternalAssured: false,
    totalDisclosures: 12,
    standardsCovered: ['ESRS E1', 'ESRS S1'],
    generatedAt: '2026-03-01T00:00:00.000Z',
    format: 'XHTML/iXBRL',
  },
  createdAt: '2026-03-01T00:00:00.000Z',
};

const mockReadiness: CsrdReadiness = {
  overall: 72,
  byStandard: { 'ESRS E1': 90, 'ESRS S1': 55 },
  missingDisclosures: ['E2-1', 'S2-3'],
  recommendations: ['Record water-related data points for ESRS E3.'],
};

describe('CsrdService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── assessMateriality ─────────────────────────────────────────────────────

  describe('assessMateriality()', () => {
    it('POSTs to /csrd/materiality/assess with the correct payload', async () => {
      mockPost.mockResolvedValue({ success: true, data: mockMaterialityResult });

      const payload = {
        assessmentYear: 2024,
        impacts: [],
        risks: [],
      };
      const result = await csrdService.assessMateriality(payload);

      expect(mockPost).toHaveBeenCalledWith('/csrd/materiality/assess', payload);
      expect(result.success).toBe(true);
      expect(result.data?.overallSummary).toBe('No significant materiality gaps.');
    });

    it('normalizes a raw (non-enveloped) response', async () => {
      mockPost.mockResolvedValue(mockMaterialityResult as unknown as never);

      const result = await csrdService.assessMateriality({
        assessmentYear: 2024,
        impacts: [],
        risks: [],
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMaterialityResult);
    });

    it('forwards error responses unchanged', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Validation failed' });

      const result = await csrdService.assessMateriality({
        assessmentYear: 2024,
        impacts: [],
        risks: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
    });
  });

  // ── getCurrentMateriality ─────────────────────────────────────────────────

  describe('getCurrentMateriality()', () => {
    it('GETs /csrd/materiality/current', async () => {
      mockGet.mockResolvedValue({ success: true, data: { id: 'mat-1' } });

      await csrdService.getCurrentMateriality();

      expect(mockGet).toHaveBeenCalledWith('/csrd/materiality/current');
    });
  });

  // ── recordDisclosure ──────────────────────────────────────────────────────

  describe('recordDisclosure()', () => {
    it('POSTs to /csrd/disclosures/record', async () => {
      mockPost.mockResolvedValue({ success: true, data: mockDisclosure });

      const payload = {
        reportingPeriod: '2024',
        standard: 'ESRS E1' as const,
        disclosureRequirement: 'E1-6',
        dataPoint: 'Scope 1 Emissions',
        value: 125000,
      };
      const result = await csrdService.recordDisclosure(payload);

      expect(mockPost).toHaveBeenCalledWith('/csrd/disclosures/record', payload);
      expect(result.data?.id).toBe('disc-1');
    });
  });

  // ── listDisclosures ───────────────────────────────────────────────────────

  describe('listDisclosures()', () => {
    it('GETs /csrd/disclosures with no query string when no filters given', async () => {
      mockGet.mockResolvedValue({ success: true, data: [mockDisclosure] });

      await csrdService.listDisclosures();

      expect(mockGet).toHaveBeenCalledWith('/csrd/disclosures');
    });

    it('appends reportingPeriod and standard query params', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] });

      await csrdService.listDisclosures({ reportingPeriod: '2024', standard: 'ESRS E1' });

      expect(mockGet).toHaveBeenCalledWith(
        '/csrd/disclosures?reportingPeriod=2024&standard=ESRS+E1',
      );
    });

    it('appends only given filter', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] });

      await csrdService.listDisclosures({ reportingPeriod: '2023' });

      expect(mockGet).toHaveBeenCalledWith('/csrd/disclosures?reportingPeriod=2023');
    });
  });

  // ── getRequirements ───────────────────────────────────────────────────────

  describe('getRequirements()', () => {
    it('GETs /csrd/disclosures/requirements with no params by default', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] });

      await csrdService.getRequirements();

      expect(mockGet).toHaveBeenCalledWith('/csrd/disclosures/requirements');
    });

    it('appends standard query param when provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] });

      await csrdService.getRequirements('ESRS S1');

      expect(mockGet).toHaveBeenCalledWith(
        '/csrd/disclosures/requirements?standard=ESRS%20S1',
      );
    });
  });

  // ── updateAssurance ───────────────────────────────────────────────────────

  describe('updateAssurance()', () => {
    it('PATCHes /csrd/disclosures/:id/assurance', async () => {
      mockPatch.mockResolvedValue({ success: true, data: mockDisclosure });

      const result = await csrdService.updateAssurance('disc-1', {
        assuranceLevel: 'REASONABLE',
        assuredBy: 'Deloitte',
      });

      expect(mockPatch).toHaveBeenCalledWith('/csrd/disclosures/disc-1/assurance', {
        assuranceLevel: 'REASONABLE',
        assuredBy: 'Deloitte',
      });
      expect(result.success).toBe(true);
    });

    it('URL-encodes the disclosure id', async () => {
      mockPatch.mockResolvedValue({ success: true, data: mockDisclosure });

      await csrdService.updateAssurance('disc/special', {
        assuranceLevel: 'LIMITED',
        assuredBy: 'KPMG',
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/csrd/disclosures/disc%2Fspecial/assurance',
        expect.any(Object),
      );
    });
  });

  // ── generateReport ────────────────────────────────────────────────────────

  describe('generateReport()', () => {
    it('POSTs { year } to /csrd/reports/generate', async () => {
      mockPost.mockResolvedValue({ success: true, data: mockReport });

      const result = await csrdService.generateReport(2024);

      expect(mockPost).toHaveBeenCalledWith('/csrd/reports/generate', { year: 2024 });
      expect(result.data?.reportingYear).toBe(2024);
    });
  });

  // ── listReports ───────────────────────────────────────────────────────────

  describe('listReports()', () => {
    it('GETs /csrd/reports', async () => {
      mockGet.mockResolvedValue({ success: true, data: [mockReport] });

      const result = await csrdService.listReports();

      expect(mockGet).toHaveBeenCalledWith('/csrd/reports');
      expect(result.data).toHaveLength(1);
    });
  });

  // ── getReadiness ──────────────────────────────────────────────────────────

  describe('getReadiness()', () => {
    it('GETs /csrd/readiness', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockReadiness });

      const result = await csrdService.getReadiness();

      expect(mockGet).toHaveBeenCalledWith('/csrd/readiness');
      expect(result.data?.overall).toBe(72);
    });
  });

  // ── verifyOffsets ─────────────────────────────────────────────────────────

  describe('verifyOffsets()', () => {
    it('POSTs tokenIds to /csrd/verify-offsets', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: { valid: true, results: [], totalValid: 2, totalTokens: 2 },
      });

      const result = await csrdService.verifyOffsets(['tok-1', 'tok-2']);

      expect(mockPost).toHaveBeenCalledWith('/csrd/verify-offsets', {
        tokenIds: ['tok-1', 'tok-2'],
      });
      expect(result.data?.totalTokens).toBe(2);
    });
  });
});
