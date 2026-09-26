/**
 * Pinata IPFS Client - Frontend Implementation
 * 
 * Provides decentralized storage for project documents, methodology evidence,
 * monitoring data, and retirement certificates via Pinata IPFS.
 * Aligns with backend IPFS patterns found in:
 * - internal/documents/ipfs_uploader.go
 * - pkg/storage/ipfs_client.go
 * - internal/documents/models.go
 * 
 * @module ipfs/pinata
 */

import { createActionableError, type ActionableError } from '../utils/errorHandler';

// ============================================================================
// Types (Align with backend document models)
// ============================================================================

/** Pinata API configuration */
export interface PinataConfig {
  /** Pinata API Key */
  apiKey: string;
  /** Pinata API Secret */
  apiSecret: string;
  /** Optional JWT token (preferred over API key/secret) */
  jwt?: string;
  /** Optional custom gateway URL */
  gateway?: string;
  /** Optional custom API base URL */
  baseUrl?: string;
}

/** Upload options matching backend IPFSClient.Add parameters */
export interface PinFileOptions {
  /** Custom metadata to attach (maps to backend document metadata) */
  metadata?: Record<string, string | number | boolean>;
  /** Pinata API options */
  pinataOptions?: {
    cidVersion?: 0 | 1;
    wrapWithDirectory?: boolean;
  };
  /** Progress tracking callback */
  onProgress?: (loaded: number, total: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/** Upload options for JSON (matches backend's structured data pinning) */
export interface PinJSONOptions {
  /** Custom metadata */
  metadata?: Record<string, string | number | boolean>;
  /** Pinata API options */
  pinataOptions?: {
    cidVersion?: 0 | 1;
  };
}

/** Pinata upload response - matches backend IPFSAddResult */
export interface PinataUploadResponse {
  /** IPFS CID (matches backend Hash field) */
  IpfsHash: string;
  /** Size in bytes (matches backend Size field) */
  PinSize: number;
  /** Timestamp */
  Timestamp: string;
  /** Whether this was a duplicate */
  isDuplicate?: boolean;
}

/** Pin status response */
export interface PinStatus {
  /** IPFS CID */
  ipfsHash: string;
  /** Size in bytes */
  size: number;
  /** Date pinned */
  datePinned: string;
  /** Pin status */
  status: 'pinned' | 'unpinning' | 'failed' | 'queued';
  /** Regions where content is pinned */
  regions?: Array<{
    regionId: string;
    currentReplicationCount: number;
    desiredReplicationCount: number;
    status: string;
  }>;
}

/** File validation result */
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** File validation options - mirrors backend validation */
export interface FileValidationOptions {
  /** Maximum file size in bytes (default: 100MB) */
  maxSize?: number;
  /** Allowed MIME types (matches backend supported types) */
  allowedTypes?: string[];
  /** Allowed file extensions */
  allowedExtensions?: string[];
  /** Minimum file size in bytes */
  minSize?: number;
}

/** Multi-file upload request */
export interface MultiFileUploadRequest {
  files: File[];
  metadata?: Record<string, string | number | boolean>;
  onFileProgress?: (file: File, loaded: number, total: number) => void;
  onTotalProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
}

/** Multi-file upload response */
export interface MultiFileUploadResponse {
  results: Array<{
    file: File;
    success: boolean;
    data?: PinataUploadResponse;
    error?: string;
  }>;
  cids: string[];
  totalSuccess: number;
  totalFailure: number;
}

// ============================================================================
// Default Configuration (Matches backend defaults)
// ============================================================================

const DEFAULT_PINATA_CONFIG: Partial<PinataConfig> = {
  baseUrl: 'https://api.pinata.cloud',
  gateway: 'https://cloudflare-ipfs.com/ipfs', // Matches backend GatewayURL
};

const DEFAULT_VALIDATION_OPTIONS: Required<FileValidationOptions> = {
  maxSize: 100 * 1024 * 1024, // 100MB - matches backend limits
  allowedTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'application/json',
    'text/plain',
    'application/zip',
    'application/vnd.rar',
  ],
  allowedExtensions: [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.jpg', '.jpeg', '.png', '.webp',
    '.csv', '.json', '.txt',
    '.zip', '.rar',
  ],
  minSize: 0,
};

// ============================================================================
// Configuration Management (Follows backend pattern)
// ============================================================================

let pinataConfig: PinataConfig | null = null;

/**
 * Initialize Pinata client - matches backend NewIPFSClient pattern
 * 
 * @param config - Pinata API configuration
 * @throws {ActionableError} If configuration is invalid
 */
export function initializePinata(config: PinataConfig): void {
  if (!config.apiKey || !config.apiSecret) {
    if (!config.jwt) {
      throw createActionableError(
        new Error('Pinata configuration missing credentials'),
        {
          category: 'validation',
          customMessage: 'Pinata requires either API key/secret or JWT token',
        }
      );
    }
  }
  pinataConfig = {
    ...DEFAULT_PINATA_CONFIG,
    ...config,
  };
}

/**
 * Get current configuration - matches backend config access pattern
 */
function getConfig(): PinataConfig {
  if (!pinataConfig) {
    throw createActionableError(
      new Error('Pinata client not initialized'),
      {
        category: 'validation',
        customMessage: 'Call initializePinata() before using IPFS features',
      }
    );
  }
  return pinataConfig;
}

/**
 * Check if Pinata is enabled - matches backend IPFSEnabled check
 */
export function isPinataEnabled(): boolean {
  return pinataConfig !== null;
}

// ============================================================================
// File Validation (Matches backend validation patterns)
// ============================================================================

/**
 * Validate a file before upload - mirrors backend validation
 * 
 * @param file - File to validate
 * @param options - Validation options
 * @returns Validation result
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size (matches backend size validation)
  if (opts.maxSize && file.size > opts.maxSize) {
    const maxMB = opts.maxSize / (1024 * 1024);
    const fileMB = file.size / (1024 * 1024);
    errors.push(`File size (${fileMB.toFixed(1)}MB) exceeds maximum allowed (${maxMB}MB)`);
  }

  if (opts.minSize && file.size < opts.minSize) {
    const minKB = opts.minSize / 1024;
    const fileKB = file.size / 1024;
    errors.push(`File size (${fileKB.toFixed(1)}KB) below minimum allowed (${minKB}KB)`);
  }

  // Check MIME type
  if (opts.allowedTypes && opts.allowedTypes.length > 0) {
    const isTypeAllowed = opts.allowedTypes.some(type => {
      if (type.includes('*')) {
        const pattern = type.replace('*', '.*');
        return new RegExp(pattern).test(file.type);
      }
      return file.type === type;
    });

    if (!isTypeAllowed && file.type) {
      errors.push(`File type "${file.type}" is not allowed`);
    }
  }

  // Check file extension (matches backend extension validation)
  if (opts.allowedExtensions && opts.allowedExtensions.length > 0) {
    const fileName = file.name.toLowerCase();
    const hasValidExtension = opts.allowedExtensions.some(ext => 
      fileName.endsWith(ext.toLowerCase())
    );
    if (!hasValidExtension) {
      const ext = file.name.split('.').pop() || 'unknown';
      errors.push(`File extension ".${ext}" is not allowed`);
    }
  }

  if (file.size === 0) {
    warnings.push('File is empty');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Core Pinata API Functions (Matches backend IPFSClient methods)
// ============================================================================

/**
 * Upload a file to IPFS - matches backend IPFSClient.Add
 * 
 * @param file - File to upload
 * @param options - Upload options
 * @returns Pinata upload response (matches IPFSAddResult)
 * @throws {ActionableError} If upload fails
 */
export async function pinFile(
  file: File,
  options: PinFileOptions = {}
): Promise<PinataUploadResponse> {
  const config = getConfig();
  const baseUrl = config.baseUrl || DEFAULT_PINATA_CONFIG.baseUrl!;

  // Validate file before upload (matches backend validation)
  const validation = validateFile(file);
  if (!validation.valid) {
    throw createActionableError(
      new Error(`File validation failed: ${validation.errors.join(', ')}`),
      {
        category: 'validation',
        customMessage: 'Invalid file',
      }
    );
  }

  // Create form data (matches backend multipart form building)
  const formData = new FormData();
  
  // Append file with metadata (matches backend document metadata)
  if (options.metadata) {
    const fileWithMetadata = new File([file], file.name, { type: file.type });
    formData.append('file', fileWithMetadata);
    
    formData.append('pinataMetadata', JSON.stringify({
      name: file.name,
      keyvalues: options.metadata,
    }));
  } else {
    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({
      name: file.name,
    }));
  }

  // Add pinata options if provided
  if (options.pinataOptions) {
    formData.append('pinataOptions', JSON.stringify(options.pinataOptions));
  }

  // Build headers with authentication
  const headers: Record<string, string> = {};
  
  if (config.jwt) {
    headers['Authorization'] = `Bearer ${config.jwt}`;
  } else {
    headers['pinata_api_key'] = config.apiKey;
    headers['pinata_secret_api_key'] = config.apiSecret;
  }

  // Create upload promise with progress tracking
  const uploadPromise = new Promise<PinataUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${baseUrl}/pinning/pinFileToIPFS`;
    
    xhr.open('POST', url);
    
    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    // Progress tracking
    if (options.onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          options.onProgress!(event.loaded, event.total);
        }
      });
    }

    // Handle response (matches backend response parsing)
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          // Validate response matches expected format (like backend IPFSAddResult)
          if (!response.IpfsHash) {
            reject(createActionableError(
              new Error('Invalid response from Pinata - missing CID'),
              {
                category: 'server',
                customMessage: 'Pinata returned invalid response',
              }
            ));
            return;
          }
          resolve(response);
        } catch (err) {
          reject(createActionableError(err, {
            category: 'server',
            customMessage: 'Invalid response from Pinata',
          }));
        }
      } else {
        let errorMessage = 'Upload failed';
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          errorMessage = errorResponse.error?.message || errorResponse.error || errorMessage;
        } catch {
          // Use default error message
        }
        
        reject(createActionableError(new Error(errorMessage), {
          statusCode: xhr.status,
          category: xhr.status >= 500 ? 'server' : 'validation',
          customMessage: errorMessage,
        }));
      }
    };

    xhr.onerror = () => {
      reject(createActionableError(new Error('Network error during upload'), {
        category: 'network',
        customMessage: 'Failed to connect to Pinata',
      }));
    };

    xhr.ontimeout = () => {
      reject(createActionableError(new Error('Upload timeout'), {
        category: 'network',
        customMessage: 'Upload took too long',
      }));
    };

    // Abort signal support
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(createActionableError(new Error('Upload cancelled'), {
          category: 'unknown',
          customMessage: 'Upload was cancelled by user',
        }));
      });
    }

    xhr.send(formData);
  });

  try {
    return await uploadPromise;
  } catch (error) {
    // Enhance error with retry information (matches backend error handling)
    if (error instanceof Error) {
      throw createActionableError(error, {
        category: 'server',
        customMessage: error.message || 'Upload failed',
        retryAction: () => pinFile(file, options),
      });
    }
    throw error;
  }
}

/**
 * Upload JSON data to IPFS - matches backend structured data pinning
 * 
 * @param data - JSON data to upload
 * @param options - Upload options
 * @returns Pinata upload response
 * @throws {ActionableError} If upload fails
 */
export async function pinJSON(
  data: Record<string, unknown>,
  options: PinJSONOptions = {}
): Promise<PinataUploadResponse> {
  const config = getConfig();
  const baseUrl = config.baseUrl || DEFAULT_PINATA_CONFIG.baseUrl!;

  const payload: Record<string, unknown> = {
    pinataContent: data,
  };

  if (options.metadata) {
    payload.pinataMetadata = {
      name: options.metadata.name || 'json-data',
      keyvalues: options.metadata,
    };
  }

  if (options.pinataOptions) {
    payload.pinataOptions = options.pinataOptions;
  }

  // Build headers with authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (config.jwt) {
    headers['Authorization'] = `Bearer ${config.jwt}`;
  } else {
    headers['pinata_api_key'] = config.apiKey;
    headers['pinata_secret_api_key'] = config.apiSecret;
  }

  try {
    const response = await fetch(`${baseUrl}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'JSON upload failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.error || errorMessage;
      } catch {
        // Use default error message
      }
      
      throw createActionableError(new Error(errorMessage), {
        statusCode: response.status,
        category: response.status >= 500 ? 'server' : 'validation',
        customMessage: errorMessage,
      });
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw createActionableError(error, {
        category: 'server',
        customMessage: error.message || 'JSON upload failed',
        retryAction: () => pinJSON(data, options),
      });
    }
    throw error;
  }
}

/**
 * Unpin content from IPFS - matches backend Pin method
 * 
 * @param cid - IPFS CID to unpin
 * @throws {ActionableError} If unpin fails
 */
export async function unpin(cid: string): Promise<void> {
  const config = getConfig();
  const baseUrl = config.baseUrl || DEFAULT_PINATA_CONFIG.baseUrl!;

  // Build headers with authentication
  const headers: Record<string, string> = {};
  
  if (config.jwt) {
    headers['Authorization'] = `Bearer ${config.jwt}`;
  } else {
    headers['pinata_api_key'] = config.apiKey;
    headers['pinata_secret_api_key'] = config.apiSecret;
  }

  try {
    const response = await fetch(`${baseUrl}/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Unpin failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.error || errorMessage;
      } catch {
        // Use default error message
      }
      
      throw createActionableError(new Error(errorMessage), {
        statusCode: response.status,
        category: response.status === 404 ? 'not_found' : 'server',
        customMessage: errorMessage,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      throw createActionableError(error, {
        category: 'server',
        customMessage: error.message || 'Unpin failed',
        retryAction: () => unpin(cid),
      });
    }
    throw error;
  }
}

/**
 * Get status of a pinned file - matches backend status checking
 * 
 * @param cid - IPFS CID to check
 * @returns Pin status
 * @throws {ActionableError} If status check fails
 */
export async function getPinStatus(cid: string): Promise<PinStatus> {
  const config = getConfig();
  const baseUrl = config.baseUrl || DEFAULT_PINATA_CONFIG.baseUrl!;

  // Build headers with authentication
  const headers: Record<string, string> = {};
  
  if (config.jwt) {
    headers['Authorization'] = `Bearer ${config.jwt}`;
  } else {
    headers['pinata_api_key'] = config.apiKey;
    headers['pinata_secret_api_key'] = config.apiSecret;
  }

  try {
    const response = await fetch(`${baseUrl}/data/pinList?hashContains=${cid}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to get pin status';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.error || errorMessage;
      } catch {
        // Use default error message
      }
      
      throw createActionableError(new Error(errorMessage), {
        statusCode: response.status,
        category: response.status === 404 ? 'not_found' : 'server',
        customMessage: errorMessage,
      });
    }

    const data = await response.json();
    
    if (data.rows && data.rows.length > 0) {
      const row = data.rows[0];
      return {
        ipfsHash: row.ipfs_pin_hash,
        size: row.size,
        datePinned: row.date_pinned,
        status: row.status,
        regions: row.regions,
      };
    }

    throw createActionableError(new Error('Pin not found'), {
      category: 'not_found',
      customMessage: `No pin found for CID: ${cid}`,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createActionableError(error, {
        category: 'server',
        customMessage: error.message || 'Failed to get pin status',
        retryAction: () => getPinStatus(cid),
      });
    }
    throw error;
  }
}

// ============================================================================
// Gateway Utilities (Matches backend GatewayURL)
// ============================================================================

/**
 * Get gateway URL for a CID - matches backend GatewayURL
 * Uses same Cloudflare gateway as backend
 * 
 * @param cid - IPFS CID
 * @param gateway - Optional custom gateway URL
 * @returns Gateway URL
 */
export function getGatewayUrl(cid: string, gateway?: string): string {
  const config = getConfig();
  const baseGateway = gateway || config.gateway || DEFAULT_PINATA_CONFIG.gateway!;
  return `${baseGateway}/${cid}`;
}

/**
 * Get gateway URL for a file with specific name
 * 
 * @param cid - IPFS CID
 * @param fileName - File name
 * @param gateway - Optional custom gateway URL
 * @returns Gateway URL
 */
export function getGatewayUrlForFile(cid: string, fileName: string, gateway?: string): string {
  const baseUrl = getGatewayUrl(cid, gateway);
  return `${baseUrl}/${encodeURIComponent(fileName)}`;
}

// ============================================================================
// Multi-file Upload (Batch operations)
// ============================================================================

/**
 * Upload multiple files - batch operation
 * 
 * @param request - Multi-file upload request
 * @returns Multi-file upload response
 */
export async function pinMultipleFiles(
  request: MultiFileUploadRequest
): Promise<MultiFileUploadResponse> {
  const { files, metadata, onFileProgress, onTotalProgress, signal } = request;
  
  if (files.length === 0) {
    throw createActionableError(
      new Error('No files to upload'),
      {
        category: 'validation',
        customMessage: 'At least one file is required',
      }
    );
  }

  // Validate all files first
  const validations = files.map(file => validateFile(file));
  const invalidFiles = validations
    .map((v, i) => ({ valid: v.valid, index: i, file: files[i], errors: v.errors }))
    .filter(v => !v.valid);

  if (invalidFiles.length > 0) {
    const invalidNames = invalidFiles.map(v => v.file.name).join(', ');
    throw createActionableError(
      new Error(`Invalid files: ${invalidNames}`),
      {
        category: 'validation',
        customMessage: `Some files are invalid: ${invalidNames}`,
      }
    );
  }

  const results: MultiFileUploadResponse['results'] = [];
  const cids: string[] = [];
  let totalSuccess = 0;
  let totalFailure = 0;

  // Track overall progress
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  // Upload each file sequentially
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileMetadata = {
      ...metadata,
      index: i,
      total: files.length,
      fileName: file.name,
    };

    try {
      const result = await pinFile(file, {
        metadata: fileMetadata,
        onProgress: (loaded, total) => {
          if (onFileProgress) {
            onFileProgress(file, loaded, total);
          }
          
          if (onTotalProgress) {
            // Calculate progress considering previous files
            const previousBytes = files.slice(0, i).reduce((sum, f) => sum + f.size, 0);
            const currentProgress = previousBytes + loaded;
            onTotalProgress(currentProgress, totalBytes);
          }
        },
        signal,
      });

      results.push({
        file,
        success: true,
        data: result,
      });
      cids.push(result.IpfsHash);
      totalSuccess++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      results.push({
        file,
        success: false,
        error: errorMessage,
      });
      totalFailure++;
    }
  }

  return {
    results,
    cids,
    totalSuccess,
    totalFailure,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a CID is valid - matches backend validation
 * 
 * @param cid - CID to validate
 * @returns Whether the CID is valid
 */
export function isValidCID(cid: string): boolean {
  // CID v0: Qm... (46 characters)
  // CID v1: b... (59 characters)
  const v0Pattern = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const v1Pattern = /^b[1-9A-HJ-NP-Za-km-z]{58}$/;
  return v0Pattern.test(cid) || v1Pattern.test(cid);
}

/**
 * Format file size for display
 * 
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${size.toFixed(1)} ${sizes[i]}`;
}

/**
 * Generate unique filename - matches backend naming patterns
 * 
 * @param originalName - Original filename
 * @param docId - Optional document ID (matches backend docID pattern)
 * @returns Unique filename
 */
export function generateUniqueFileName(originalName: string, docId?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.includes('.') 
    ? originalName.substring(originalName.lastIndexOf('.'))
    : '';
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
  
  if (docId) {
    return `${docId}-${timestamp}-${random}${extension}`;
  }
  return `${cleanBaseName}-${timestamp}-${random}${extension}`;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Pinata upload response
 */
export function isPinataUploadResponse(response: unknown): response is PinataUploadResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'IpfsHash' in response &&
    typeof (response as PinataUploadResponse).IpfsHash === 'string'
  );
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  initializePinata,
  isPinataEnabled,
  pinFile,
  pinJSON,
  unpin,
  getPinStatus,
  pinMultipleFiles,
  getGatewayUrl,
  getGatewayUrlForFile,
  validateFile,
  isValidCID,
  formatFileSize,
  generateUniqueFileName,
  isPinataUploadResponse,
};