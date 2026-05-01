import { ApiResponse, apiClient } from './api-client';
import type {
  CreateMaterialityAssessmentPayload,
  MaterialityAssessment,
  MaterialityAssessmentResult,
  RecordDisclosurePayload,
  DisclosureQuery,
  Disclosure,
  DisclosureRequirement,
  UpdateAssurancePayload,
  CsrdReport,
  CsrdReadiness,
  OffsetVerificationResult,
  EsrsStandard,
} from '@/types/csrd';

class CsrdService {
  private normalizeResponse<T>(response: ApiResponse<T> | T): ApiResponse<T> {
    if (response && typeof response === 'object' && 'success' in response) {
      return response as ApiResponse<T>;
    }
    return {
      success: true,
      data: response as T,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /api/v1/csrd/materiality/assess
   * Run or update the double-materiality assessment.
   */
  async assessMateriality(
    payload: CreateMaterialityAssessmentPayload,
  ): Promise<ApiResponse<MaterialityAssessmentResult>> {
    const response = await apiClient.post<MaterialityAssessmentResult>(
      '/csrd/materiality/assess',
      payload,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/csrd/materiality/current
   * Retrieve the most recent materiality assessment for the authenticated company.
   */
  async getCurrentMateriality(): Promise<ApiResponse<MaterialityAssessment>> {
    const response = await apiClient.get<MaterialityAssessment>(
      '/csrd/materiality/current',
    );
    return this.normalizeResponse(response);
  }

  /**
   * POST /api/v1/csrd/disclosures/record
   * Record a single ESRS disclosure data point.
   */
  async recordDisclosure(
    payload: RecordDisclosurePayload,
  ): Promise<ApiResponse<Disclosure>> {
    const response = await apiClient.post<Disclosure>(
      '/csrd/disclosures/record',
      payload,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/csrd/disclosures
   * List disclosures, optionally filtered by period and standard.
   */
  async listDisclosures(
    query: DisclosureQuery = {},
  ): Promise<ApiResponse<Disclosure[]>> {
    const params = new URLSearchParams();
    if (query.reportingPeriod)
      params.set('reportingPeriod', query.reportingPeriod);
    if (query.standard) params.set('standard', query.standard);

    const qs = params.toString();
    const response = await apiClient.get<Disclosure[]>(
      `/csrd/disclosures${qs ? `?${qs}` : ''}`,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/csrd/disclosures/requirements
   * Fetch ESRS disclosure requirements, optionally filtered by standard.
   */
  async getRequirements(
    standard?: EsrsStandard,
  ): Promise<ApiResponse<DisclosureRequirement[]>> {
    const params = standard
      ? `?standard=${encodeURIComponent(standard)}`
      : '';
    const response = await apiClient.get<DisclosureRequirement[]>(
      `/csrd/disclosures/requirements${params}`,
    );
    return this.normalizeResponse(response);
  }

  /**
   * PATCH /api/v1/csrd/disclosures/:id/assurance
   * Update the assurance status of an existing disclosure.
   */
  async updateAssurance(
    id: string,
    payload: UpdateAssurancePayload,
  ): Promise<ApiResponse<Disclosure>> {
    const response = await apiClient.patch<Disclosure>(
      `/csrd/disclosures/${encodeURIComponent(id)}/assurance`,
      payload,
    );
    return this.normalizeResponse(response);
  }

  /**
   * POST /api/v1/csrd/reports/generate
   * Generate a CSRD report for the given year.
   */
  async generateReport(year: number): Promise<ApiResponse<CsrdReport>> {
    const response = await apiClient.post<CsrdReport>('/csrd/reports/generate', { year });
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/csrd/reports
   * List all CSRD reports for the authenticated company.
   */
  async listReports(): Promise<ApiResponse<CsrdReport[]>> {
    const response = await apiClient.get<CsrdReport[]>('/csrd/reports');
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/csrd/readiness
   * Retrieve CSRD readiness scorecard.
   */
  async getReadiness(): Promise<ApiResponse<CsrdReadiness>> {
    const response = await apiClient.get<CsrdReadiness>('/csrd/readiness');
    return this.normalizeResponse(response);
  }

  /**
   * POST /api/v1/csrd/verify-offsets
   * Verify carbon offset tokens for CSRD compliance purposes.
   */
  async verifyOffsets(
    tokenIds: string[],
  ): Promise<ApiResponse<OffsetVerificationResult>> {
    const response = await apiClient.post<OffsetVerificationResult>(
      '/csrd/verify-offsets',
      { tokenIds },
    );
    return this.normalizeResponse(response);
  }
}

export const csrdService = new CsrdService();
