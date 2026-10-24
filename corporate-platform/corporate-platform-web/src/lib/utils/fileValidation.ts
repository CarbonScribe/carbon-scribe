/**
 * Client-side file type and size prevalidation for IPFS uploads (#718).
 */

/** Hard upper bound — independent of CHUNKED_UPLOAD_THRESHOLD (strategy only). */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.txt',
  '.csv',
  '.json',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
] as const;

export const CERTIFICATE_MIME_TYPES = ['application/pdf'] as const;
export const CERTIFICATE_EXTENSIONS = ['.pdf'] as const;

export const DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
export const CERTIFICATE_ACCEPT = 'application/pdf';

export interface ValidateFileOptions {
  maxSize?: number;
  allowedTypes?: readonly string[];
  allowedExtensions?: readonly string[];
}

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function validateFile(
  file: File,
  options: ValidateFileOptions = {},
): FileValidationResult {
  const maxSize = options.maxSize ?? MAX_UPLOAD_BYTES;
  const allowedTypes = options.allowedTypes ?? ALLOWED_DOCUMENT_MIME_TYPES;
  const allowedExtensions =
    options.allowedExtensions ?? ALLOWED_DOCUMENT_EXTENSIONS;

  if (!file || !(file instanceof File)) {
    return { ok: false, error: 'No file selected.' };
  }
  if (file.size <= 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (file.size > maxSize) {
    const mb = (maxSize / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `File exceeds the maximum size of ${mb} MB.` };
  }

  const ext = extensionOf(file.name);
  const mimeOk =
    !file.type ||
    (allowedTypes as readonly string[]).includes(file.type);
  const extOk = (allowedExtensions as readonly string[]).includes(ext);

  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: `File type not allowed (${file.type || ext || 'unknown'}). Allowed: ${allowedExtensions.join(', ')}.`,
    };
  }
  return { ok: true };
}

export function validateCertificateFile(file: File): FileValidationResult {
  return validateFile(file, {
    maxSize: MAX_UPLOAD_BYTES,
    allowedTypes: CERTIFICATE_MIME_TYPES,
    allowedExtensions: CERTIFICATE_EXTENSIONS,
  });
}
