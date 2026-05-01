import { ApiResponse, apiClient } from './api-client';
import type {
  RetireCreditsPayload,
  RetirementRecord,
  RetirementStats,
  RetirementHistoryQuery,
  RetirementHistoryResponse,
  RetirementValidationResult,
  EntityCertificate,
  RetirementHistoryMeta,
} from '@/types/retirement';

class RetirementService {
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
   * POST /api/v1/retirements
   * Instantly retire a carbon credit.
   */
  async retire(
    payload: RetireCreditsPayload,
  ): Promise<ApiResponse<RetirementRecord>> {
    const response = await apiClient.post<RetirementRecord>(
      '/retirements',
      payload,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/retirements
   * Fetch paginated retirement history with optional filters.
   */
  async getHistory(
    query: RetirementHistoryQuery = {},
  ): Promise<ApiResponse<RetirementHistoryResponse>> {
    const params = new URLSearchParams();
    if (query.startDate) params.set('startDate', query.startDate);
    if (query.endDate) params.set('endDate', query.endDate);
    if (query.purpose) params.set('purpose', query.purpose);
    if (query.creditProject) params.set('creditProject', query.creditProject);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));

    const qs = params.toString();
    const response = await apiClient.get<RetirementHistoryResponse>(
      `/retirements${qs ? `?${qs}` : ''}`,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/retirements/:id
   * Fetch details for a specific retirement record.
   */
  async getById(id: string): Promise<ApiResponse<RetirementRecord>> {
    const response = await apiClient.get<RetirementRecord>(
      `/retirements/${encodeURIComponent(id)}`,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/retirements/stats
   * Fetch aggregate retirement stats for the authenticated company.
   */
  async getStats(): Promise<ApiResponse<RetirementStats>> {
    const response = await apiClient.get<RetirementStats>('/retirements/stats');
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/retirements/validate
   * Validate that the given credit/amount combination can be retired.
   */
  async validate(
    creditId: string,
    amount: number,
  ): Promise<ApiResponse<RetirementValidationResult>> {
    const params = new URLSearchParams({
      creditId,
      amount: String(amount),
    });
    const response = await apiClient.get<RetirementValidationResult>(
      `/retirements/validate?${params.toString()}`,
    );
    return this.normalizeResponse(response);
  }

  /**
   * Returns the direct PDF download URL for a retirement certificate.
   * The URL requires a valid JWT in the Authorization header; open
   * via fetch + Blob or window.open after setting the token in a cookie.
   */
  getCertificateDownloadUrl(retirementId: string): string {
    const base =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    return `${base}/retirements/${encodeURIComponent(retirementId)}/certificate`;
  }

  /**
   * GET /api/v1/retirements/entity/:address/certificates
   * List all certificates for a given entity address (companyId).
   */
  async getEntityCertificates(
    address: string,
    page = 1,
    limit = 20,
  ): Promise<
    ApiResponse<{ data: EntityCertificate[]; meta: RetirementHistoryMeta }>
  > {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    const response = await apiClient.get<{
      data: EntityCertificate[];
      meta: RetirementHistoryMeta;
    }>(
      `/retirements/entity/${encodeURIComponent(address)}/certificates?${params.toString()}`,
    );
    return this.normalizeResponse(response);
  }

  /**
   * GET /api/v1/retirements/export/csv
   * Download retirement history as a CSV blob.
   */
  async exportCsv(): Promise<Blob | null> {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null;
    const base =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${base}/retirements/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.blob();
  }
}

export const retirementService = new RetirementService();
export default RetirementService;
