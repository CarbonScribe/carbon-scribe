/**
 * Centralized upload size and MIME type policy (issue #342).
 * Centralized storage-class policy for critical vs non-critical documents (issue #341).
 *
 * All upload endpoints must enforce these constraints.
 */

// ---------------------------------------------------------------------------
// Upload size limits (#342)
// ---------------------------------------------------------------------------

/** Maximum file size for a single upload: 50 MB */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum total size for a batch upload request: 200 MB */
export const MAX_BATCH_SIZE_BYTES = 200 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Allowed MIME types (#342)
// ---------------------------------------------------------------------------

export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'text/plain',
]);

// ---------------------------------------------------------------------------
// Storage-class policy (#341)
// ---------------------------------------------------------------------------

export enum DocumentStorageClass {
  /** High-value records: audit certificates, compliance evidence. */
  CRITICAL = 'CRITICAL',
  /** Routine attachments, temporary uploads. */
  NON_CRITICAL = 'NON_CRITICAL',
}

export interface StorageClassPolicy {
  /** Minimum number of IPFS pins required. */
  minPins: number;
  /** Retention in days; null = indefinite. */
  retentionDays: number | null;
  /** Whether to verify integrity on retrieval. */
  integrityCheck: boolean;
}

export const STORAGE_CLASS_POLICIES: Record<
  DocumentStorageClass,
  StorageClassPolicy
> = {
  [DocumentStorageClass.CRITICAL]: {
    minPins: 3,
    retentionDays: null, // indefinite
    integrityCheck: true,
  },
  [DocumentStorageClass.NON_CRITICAL]: {
    minPins: 1,
    retentionDays: 90,
    integrityCheck: false,
  },
};

/**
 * Document types that are classified as CRITICAL.
 * All other document types default to NON_CRITICAL.
 */
export const CRITICAL_DOCUMENT_TYPES: ReadonlySet<string> = new Set([
  'CERTIFICATE',
  'AUDIT_REPORT',
  'COMPLIANCE_EVIDENCE',
  'RETIREMENT_PROOF',
  'VERIFICATION_REPORT',
]);

/**
 * Resolve the storage class for a given document type.
 */
export function resolveStorageClass(documentType: string): DocumentStorageClass {
  return CRITICAL_DOCUMENT_TYPES.has(documentType)
    ? DocumentStorageClass.CRITICAL
    : DocumentStorageClass.NON_CRITICAL;
}
