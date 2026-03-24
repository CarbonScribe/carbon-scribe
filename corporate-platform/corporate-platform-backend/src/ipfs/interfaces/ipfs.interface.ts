export interface IpfsDocumentRecord {
  id?: string;
  companyId: string;
  documentType: string;
  referenceId?: string;
  ipfsCid: string;
  ipfsGateway?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  pinned?: boolean;
  pinnedAt?: Date;
  metadata?: any;
  createdAt?: Date;
  expiresAt?: Date | null;
}
