import { getAccessToken } from '@/lib/auth/token-storage';
import { ApiResponse, apiClient } from './api-client';
import { chunkedUpload } from '@/lib/utils/chunkedUpload';
import type { UploadProgress } from '@/lib/utils/chunkedUpload';
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

/** Files at or above this size use the chunked/resumable upload path (10 MB). */
export const CHUNKED_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

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
    return getAccessToken();
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

  /**
   * Chunked/resumable upload for files at or above CHUNKED_UPLOAD_THRESHOLD.
   * Sends the file in 2 MB slices with Content-Range headers.  Each chunk
   * is independently retried with exponential backoff.  Progress and cancellation
   * are driven by the caller via onProgress / signal.
   */
  async uploadChunked(
    file: File,
    metadata: Record<string, string>,
    options: {
      sessionKey: string
      onProgress?: (progress: UploadProgress) => void
      signal?: AbortSignal
    },
  ): Promise<ApiResponse<IpfsUploadResponse>> {
    try {
      const result = await chunkedUpload({
        url: `${API_BASE_URL}/ipfs/upload/chunked`,
        file,
        metadata,
        sessionKey: options.sessionKey,
        onProgress: options.onProgress,
        signal: options.signal,
      })

      if (!result.cid) {
        return { success: false, error: 'Chunked upload completed but no CID was returned' }
      }

      return { success: true, data: { cid: result.cid } }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Upload cancelled', isCancelled: true }
      }
      return { success: false, error: err instanceof Error ? err.message : 'Chunked upload failed' }
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

  async listDocuments(
    companyIdOrParams?: string | { companyId?: string; page?: number; limit?: number },
    pagination?: { page?: number; limit?: number },
  ): Promise<ApiResponse<IpfsDocumentRecord[]>> {
    let companyId: string | undefined;
    let page: number | undefined;
    let limit: number | undefined;

    if (typeof companyIdOrParams === 'string') {
      companyId = companyIdOrParams;
      page = pagination?.page;
      limit = pagination?.limit;
    } else if (companyIdOrParams && typeof companyIdOrParams === 'object') {
      companyId = companyIdOrParams.companyId;
      page = companyIdOrParams.page;
      limit = companyIdOrParams.limit;
    }

    const queryParams = new URLSearchParams();
    if (companyId) queryParams.set('companyId', companyId);
    if (page !== undefined && page !== null) queryParams.set('page', String(page));
    if (limit !== undefined && limit !== null) queryParams.set('limit', String(limit));

    const qs = queryParams.toString();
    const endpoint = qs ? `/ipfs/documents?${qs}` : '/ipfs/documents';
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
