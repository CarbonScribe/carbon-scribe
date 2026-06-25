/**
 * Standardized API Error Parser
 * Handles multiple error envelope shapes from different backend services
 * and provides consistent, user-friendly error messages.
 */

/**
 * Error code categories for conditional handling
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Parsed error structure with standardized fields
 */
export interface ParsedError {
  message: string;
  code: ErrorCode;
  statusCode?: number;
  fieldErrors?: Record<string, string[]>;
  originalError?: unknown;
}

/**
 * HTTP status code to user-friendly message mapping
 */
const STATUS_CODE_MESSAGES: Record<number, string> = {
  400: 'Bad request. Please check your input.',
  401: 'Authentication required. Please log in.',
  403: 'Access denied. You do not have permission.',
  404: 'Resource not found.',
  409: 'Conflict. The resource already exists.',
  422: 'Validation error. Please check your input.',
  429: 'Too many requests. Please try again later.',
  500: 'Server error. Please try again later.',
  502: 'Bad gateway. Please try again later.',
  503: 'Service unavailable. Please try again later.',
  504: 'Gateway timeout. Please try again later.',
};

/**
 * HTTP status code to error code mapping
 */
const STATUS_CODE_TO_ERROR: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.AUTH_ERROR,
  403: ErrorCode.AUTH_ERROR,
  404: ErrorCode.NOT_FOUND,
  422: ErrorCode.VALIDATION_ERROR,
  429: ErrorCode.SERVER_ERROR,
  500: ErrorCode.SERVER_ERROR,
  502: ErrorCode.SERVER_ERROR,
  503: ErrorCode.SERVER_ERROR,
  504: ErrorCode.SERVER_ERROR,
};

/**
 * Extract message from various error envelope shapes
 */
function extractMessage(body: unknown, statusCode?: number): string {
  if (typeof body === 'string') {
    return body;
  }

  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;

    // Shape: { message: string }
    if (typeof obj.message === 'string') {
      return obj.message;
    }

    // Shape: { error: string }
    if (typeof obj.error === 'string') {
      return obj.error;
    }

    // Shape: { error: { message: string } }
    if (typeof obj.error === 'object' && obj.error !== null) {
      const errorObj = obj.error as Record<string, unknown>;
      if (typeof errorObj.message === 'string') {
        return errorObj.message;
      }
    }

    // Shape: { errors: Array<{ message: string }> }
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const firstError = obj.errors[0] as Record<string, unknown>;
      if (typeof firstError.message === 'string') {
        return firstError.message;
      }
      // If errors array contains strings directly
      if (typeof firstError === 'string') {
        return firstError;
      }
    }

    // Shape: { title: string, detail: string } - check this BEFORE standalone detail
    if (typeof obj.title === 'string' && typeof obj.detail === 'string') {
      return `${obj.title}: ${obj.detail}`;
    }

    // Shape: { title: string, detail: { message: string } }
    if (typeof obj.title === 'string' && typeof obj.detail === 'object' && obj.detail !== null) {
      const detailObj = obj.detail as Record<string, unknown>;
      if (typeof detailObj.message === 'string') {
        return `${obj.title}: ${detailObj.message}`;
      }
    }

    // Shape: { detail: string }
    if (typeof obj.detail === 'string') {
      return obj.detail;
    }

    // Shape: { title: string }
    if (typeof obj.title === 'string') {
      return obj.title;
    }
  }

  // Fallback to status code message if available
  if (statusCode && STATUS_CODE_MESSAGES[statusCode]) {
    return STATUS_CODE_MESSAGES[statusCode];
  }

  // Final fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Extract field-level validation errors
 */
function extractFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const obj = body as Record<string, unknown>;

  // Shape: { errors: { field: ['error message'] } }
  if (typeof obj.errors === 'object' && obj.errors !== null && !Array.isArray(obj.errors)) {
    const errorsObj = obj.errors as Record<string, unknown>;
    const fieldErrors: Record<string, string[]> = {};

    for (const [field, value] of Object.entries(errorsObj)) {
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        fieldErrors[field] = value as string[];
      } else if (typeof value === 'string') {
        fieldErrors[field] = [value];
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return fieldErrors;
    }
  }

  // Shape: { fieldErrors: { field: ['error message'] } }
  if (typeof obj.fieldErrors === 'object' && obj.fieldErrors !== null) {
    const fieldErrorsObj = obj.fieldErrors as Record<string, unknown>;
    const fieldErrors: Record<string, string[]> = {};

    for (const [field, value] of Object.entries(fieldErrorsObj)) {
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        fieldErrors[field] = value as string[];
      } else if (typeof value === 'string') {
        fieldErrors[field] = [value];
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return fieldErrors;
    }
  }

  return undefined;
}

/**
 * Determine error code from status code and error body
 */
function determineErrorCode(body: unknown, statusCode?: number): ErrorCode {
  if (statusCode && STATUS_CODE_TO_ERROR[statusCode]) {
    return STATUS_CODE_TO_ERROR[statusCode];
  }

  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;

    // Check for validation-related fields
    if (obj.validation || (obj.errors && typeof obj.errors === 'object' && !Array.isArray(obj.errors))) {
      return ErrorCode.VALIDATION_ERROR;
    }

    // Check for auth-related fields
    if (obj.auth || obj.unauthorized || obj.forbidden) {
      return ErrorCode.AUTH_ERROR;
    }

    // Check for not-found-related fields
    if (obj.notFound || obj.not_found) {
      return ErrorCode.NOT_FOUND;
    }
  }

  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Parse API error response into standardized format
 * Handles multiple error envelope shapes and provides consistent error messaging
 */
export function parseApiError(
  error: unknown,
  statusCode?: number,
): ParsedError {
  // Handle network errors (no response)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Network error. Please check your connection and try again.',
      code: ErrorCode.NETWORK_ERROR,
      originalError: error,
    };
  }

  // Handle AbortError (timeout)
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      message: 'Request timed out. Please try again.',
      code: ErrorCode.NETWORK_ERROR,
      originalError: error,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: error.message || 'Something went wrong. Please try again.',
      code: determineErrorCode(undefined, statusCode),
      statusCode,
      originalError: error,
    };
  }

  // Handle API response bodies
  const message = extractMessage(error, statusCode);
  const fieldErrors = extractFieldErrors(error);
  const code = determineErrorCode(error, statusCode);

  return {
    message,
    code,
    statusCode,
    fieldErrors,
    originalError: error,
  };
}

/**
 * Get user-friendly message for an error code
 */
export function getErrorMessageForCode(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCode.AUTH_ERROR]: 'Authentication required. Please log in.',
    [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorCode.SERVER_ERROR]: 'Server error. Please try again later.',
    [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',
    [ErrorCode.UNKNOWN_ERROR]: 'Something went wrong. Please try again.',
  };

  return messages[code] || messages[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Format field errors for display
 */
export function formatFieldErrors(fieldErrors: Record<string, string[]>): string[] {
  const messages: string[] = [];

  for (const [field, errors] of Object.entries(fieldErrors)) {
    for (const error of errors) {
      messages.push(`${field}: ${error}`);
    }
  }

  return messages;
}

/**
 * Check if error is a specific type
 */
export function isErrorType(parsedError: ParsedError, code: ErrorCode): boolean {
  return parsedError.code === code;
}

/**
 * Check if error has field-level validation errors
 */
export function hasFieldErrors(parsedError: ParsedError): boolean {
  return !!parsedError.fieldErrors && Object.keys(parsedError.fieldErrors).length > 0;
}

/**
 * Check if an error is retryable based on its code and status
 */
export function isRetryableParsedError(parsedError: ParsedError): boolean {
  // Network errors are retryable
  if (parsedError.code === ErrorCode.NETWORK_ERROR) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (parsedError.code === ErrorCode.SERVER_ERROR) {
    return true;
  }

  // 408 Request Timeout is retryable
  if (parsedError.statusCode === 408) {
    return true;
  }

  // 429 Too Many Requests is retryable
  if (parsedError.statusCode === 429) {
    return true;
  }

  return false;
}

/**
 * Check if an error is a client error (non-retryable)
 */
export function isClientError(parsedError: ParsedError): boolean {
  if (!parsedError.statusCode) return false;
  
  const statusCode = parsedError.statusCode;
  
  // 4xx errors are client errors, except 408 and 429
  if (statusCode >= 400 && statusCode < 500) {
    return statusCode !== 408 && statusCode !== 429;
  }
  
  return false;
}
