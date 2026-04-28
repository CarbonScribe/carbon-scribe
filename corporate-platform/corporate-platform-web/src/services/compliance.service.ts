import { apiClient, ApiResponse } from './api-client';
import {
  ComplianceCheckResult,
  ComplianceStatusItem,
  ComplianceReport,
  CheckComplianceRequest,
} from '@/types';

/**
 * Compliance API Service
 * Handles all compliance-related API calls
 */
class ComplianceService {
  /**
   * Run compliance checks on an entity
   * POST /compliance/check
   */
  async checkCompliance(
    request: CheckComplianceRequest,
  ): Promise<ApiResponse<ComplianceCheckResult>> {
    return apiClient.post<ComplianceCheckResult>('/compliance/check', request);
  }

  /**
   * Get compliance status for an entity
   * GET /compliance/status/:entityId
   */
  async getComplianceStatus(
    entityId: string,
  ): Promise<ApiResponse<ComplianceStatusItem[]>> {
    return apiClient.get<ComplianceStatusItem[]>(
      `/compliance/status/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Get compliance report for an entity
   * GET /compliance/report/:entityId
   */
  async getComplianceReport(
    entityId: string,
  ): Promise<ApiResponse<ComplianceReport>> {
    return apiClient.get<ComplianceReport>(
      `/compliance/report/${encodeURIComponent(entityId)}`,
    );
  }

  /**
   * Export compliance report as PDF
   * GET /compliance/report/:entityId?format=pdf
   */
  async exportComplianceReportPdf(
    entityId: string,
  ): Promise<Blob | null> {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('accessToken')
          : null;
      const headers: HeadersInit = {
        Authorization: token ? `Bearer ${token}` : '',
      };

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const url = `${baseUrl}/compliance/report/${encodeURIComponent(entityId)}?format=pdf`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error(`Failed to export report: ${response.statusText}`);
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('Error exporting compliance report:', error);
      return null;
    }
  }

  /**
   * Get all compliance statuses for company
   * GET /compliance/status (without entityId)
   */
  async getAllComplianceStatuses(): Promise<ApiResponse<ComplianceStatusItem[]>> {
    return apiClient.get<ComplianceStatusItem[]>('/compliance/status');
  }
}

export const complianceService = new ComplianceService();
export default ComplianceService;
