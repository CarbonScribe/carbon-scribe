/**
 * Base domain error class for all business errors
 * Provides consistent error structure with code, message, statusCode, and details
 */
export abstract class DomainError extends Error {
  public readonly name: string;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    name: string,
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Ensure prototype chain is correctly set
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Check if this is a business/domain error (4xx)
   */
  isBusinessError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /**
   * Convert to a plain object for response serialization
   */
  toJSON(): {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Error code taxonomy
 * Format: CATEGORY_SEQUENCE
 * Categories:
 * - AUTH: Authentication/Authorization errors
 * - VALIDATION: Input validation errors
 * - NOT_FOUND: Resource not found errors
 * - CONFLICT: Resource conflict errors (duplicate, state mismatch)
 * - BUSINESS: General business rule violations
 * - DATABASE: Database operation errors
 * - EXTERNAL: External service errors
 * - INTERNAL: Internal server errors
 * - TIMEOUT: Upstream call timeout errors
 * - CIRCUIT: Circuit breaker errors
 */
export const ErrorCodes = {
  // Authentication & Authorization (AUTH)
  AUTH_001: 'AUTH_001', // Invalid credentials
  AUTH_002: 'AUTH_002', // Unauthorized access
  AUTH_003: 'AUTH_003', // Invalid/expired token
  AUTH_004: 'AUTH_004', // Insufficient permissions
  AUTH_005: 'AUTH_005', // Account locked
  AUTH_006: 'AUTH_006', // Account inactive
  AUTH_007: 'AUTH_007', // Invalid refresh token
  AUTH_008: 'AUTH_008', // Session expired
  AUTH_009: 'AUTH_009', // Invalid password reset token

  // Validation (VALIDATION)
  VALIDATION_001: 'VALIDATION_001', // General validation error
  VALIDATION_002: 'VALIDATION_002', // Invalid email format
  VALIDATION_003: 'VALIDATION_003', // Invalid input format
  VALIDATION_004: 'VALIDATION_004', // Field validation error

  // Not Found (NOT_FOUND)
  NOT_FOUND_001: 'NOT_FOUND_001', // Resource not found
  NOT_FOUND_002: 'NOT_FOUND_002', // User not found
  NOT_FOUND_003: 'NOT_FOUND_003', // Credit not found
  NOT_FOUND_004: 'NOT_FOUND_004', // Company not found
  NOT_FOUND_005: 'NOT_FOUND_005', // Retirement not found
  NOT_FOUND_006: 'NOT_FOUND_006', // Session not found
  NOT_FOUND_007: 'NOT_FOUND_007', // Project not found

  // Conflict (CONFLICT)
  CONFLICT_001: 'CONFLICT_001', // Resource already exists
  CONFLICT_002: 'CONFLICT_002', // Email already in use
  CONFLICT_003: 'CONFLICT_003', // Credit already retired
  CONFLICT_004: 'CONFLICT_004', // State conflict
  CONFLICT_005: 'CONFLICT_005', // Unique constraint violation

  // Business (BUSINESS)
  BUSINESS_001: 'BUSINESS_001', // Insufficient balance
  BUSINESS_002: 'BUSINESS_002', // Invalid operation
  BUSINESS_003: 'BUSINESS_003', // Business rule violation
  BUSINESS_004: 'BUSINESS_004', // Insufficient credits
  BUSINESS_005: 'BUSINESS_005', // Invalid credit status
  BUSINESS_006: 'BUSINESS_006', // Credit not available
  BUSINESS_007: 'BUSINESS_007', // Invalid retirement amount

  // Database (DATABASE)
  DATABASE_001: 'DATABASE_001', // Database operation failed
  DATABASE_002: 'DATABASE_002', // Record not found in database
  DATABASE_003: 'DATABASE_003', // Unique constraint violation
  DATABASE_004: 'DATABASE_004', // Foreign key constraint violation
  DATABASE_005: 'DATABASE_005', // Database connection error

  // External (EXTERNAL)
  EXTERNAL_001: 'EXTERNAL_001', // External service error
  EXTERNAL_002: 'EXTERNAL_002', // Stellar network error
  EXTERNAL_003: 'EXTERNAL_003', // IPFS error
  EXTERNAL_004: 'EXTERNAL_004', // Blockchain transaction failed

  // Internal (INTERNAL)
  INTERNAL_001: 'INTERNAL_001', // Internal server error
  INTERNAL_002: 'INTERNAL_002', // Unexpected error

  // Timeout (TIMEOUT)
  TIMEOUT_001: 'TIMEOUT_001', // Upstream call timed out

  // Circuit Breaker (CIRCUIT)
  CIRCUIT_001: 'CIRCUIT_001', // Circuit breaker open
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
