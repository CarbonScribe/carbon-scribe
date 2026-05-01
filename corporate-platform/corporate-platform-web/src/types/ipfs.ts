export type IpfsDocumentType =
  | 'CERTIFICATE'
  | 'REPORT'
  | 'AUDIT_LOG'
  | 'PROOF'
  | 'UNKNOWN';

export interface IpfsDocumentRecord {
  id: string;
  companyId: string;
  documentType: IpfsDocumentType;
  referenceId: string;
  ipfsCid: string;
  ipfsGateway: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pinned: boolean;
  pinnedAt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string | null;
}

export interface IpfsUploadResponse {
  cid: string;
  record?: IpfsDocumentRecord;
  warning?: string;
  error?: string;
}

export interface IpfsBatchUploadRequest {
  files: Array<{ fileName: string; content: string }>;
  metadata?: Record<string, unknown>;
}

export interface IpfsPinBatchResponseItem {
  cid: string;
  pinned: boolean;
  error?: string;
}

export interface IpfsRetrieveResponse {
  cid: string;
  url: string;
  data?: string;
  contentType?: string;
  error?: string;
  details?: string;
}

export interface IpfsMetadataResponse {
  cid?: string;
  url?: string;
  error?: string;
}

export interface IpfsCertificateVerifyResponse {
  cid: string;
  verified: boolean;
  reason?: string;
  doc?: IpfsDocumentRecord;
}

export interface IpfsCertificateAnchorRequest {
  content?: string;
  cid?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
}
