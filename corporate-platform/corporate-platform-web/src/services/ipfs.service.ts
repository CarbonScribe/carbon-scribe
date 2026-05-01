import { ApiResponse, apiClient } from './api-client';
import type {
  IpfsBatchUploadRequest,
  IpfsCertificateAnchorRequest,
  IpfsCertificateVerifyResponse,
  IpfsDocumentRecord,
  IpfsMetadataResponse,
  IpfsPinBatchResponseItem,
  IpfsRetrieveResponse,
  IpfsUploadResponse,
} from '@/types/ipfs';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class IpfsService {
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

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  async uploadDocument(
    file: File,
    metadata: Record<string, unknown>,
  ): Promise<ApiResponse<IpfsUploadResponse>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      const token = this.getAuthToken();
      const response = await fetch(`${API_BASE_URL}/ipfs/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data?.message || data?.error || `Upload failed (${response.status})`,
        };
      }

      return this.normalizeResponse<IpfsUploadResponse>(data);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async batchUpload(
    payload: IpfsBatchUploadRequest,
  ): Promise<ApiResponse<IpfsUploadResponse[]>> {
    const response = await apiClient.post<IpfsUploadResponse[]>(
      '/ipfs/batch/upload',
      payload,
    );
    return this.normalizeResponse(response);
  }

  async batchPin(cids: string[]): Promise<ApiResponse<IpfsPinBatchResponseItem[]>> {
    const response = await apiClient.post<IpfsPinBatchResponseItem[]>(
      '/ipfs/batch/pin',
      { cids },
    );
    return this.normalizeResponse(response);
  }

  async getByCid(cid: string): Promise<ApiResponse<IpfsRetrieveResponse>> {
    const response = await apiClient.get<IpfsRetrieveResponse>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
    return this.normalizeResponse(response);
  }

  async getMetadata(cid: string): Promise<ApiResponse<IpfsMetadataResponse>> {
    const response = await apiClient.get<IpfsMetadataResponse>(
      `/ipfs/${encodeURIComponent(cid)}/metadata`,
    );
    return this.normalizeResponse(response);
  }

  async deleteByCid(cid: string): Promise<ApiResponse<Record<string, unknown>>> {
    const response = await apiClient.delete<Record<string, unknown>>(
      `/ipfs/${encodeURIComponent(cid)}`,
    );
    return this.normalizeResponse(response);
  }

  async anchorCertificate(
    retirementId: string,
    payload: IpfsCertificateAnchorRequest,
  ): Promise<ApiResponse<IpfsUploadResponse | { cid: string; attached: boolean }>> {
    const response = await apiClient.post<IpfsUploadResponse | { cid: string; attached: boolean }>(
      `/ipfs/certificate/${encodeURIComponent(retirementId)}`,
      payload,
    );
    return this.normalizeResponse(response);
  }

  async verifyCertificate(
    cid: string,
  ): Promise<ApiResponse<IpfsCertificateVerifyResponse>> {
    const response = await apiClient.get<IpfsCertificateVerifyResponse>(
      `/ipfs/certificate/${encodeURIComponent(cid)}/verify`,
    );
    return this.normalizeResponse(response);
  }

  async listDocuments(companyId?: string): Promise<ApiResponse<IpfsDocumentRecord[]>> {
    const endpoint = companyId
      ? `/ipfs/documents?companyId=${encodeURIComponent(companyId)}`
      : '/ipfs/documents';
    const response = await apiClient.get<IpfsDocumentRecord[]>(endpoint);
    return this.normalizeResponse(response);
  }

  async getDocumentsByReference(
    referenceId: string,
  ): Promise<ApiResponse<IpfsDocumentRecord[]>> {
    const response = await apiClient.get<IpfsDocumentRecord[]>(
      `/ipfs/documents/${encodeURIComponent(referenceId)}`,
    );
    return this.normalizeResponse(response);
  }
}

export const ipfsService = new IpfsService();
export default IpfsService;
