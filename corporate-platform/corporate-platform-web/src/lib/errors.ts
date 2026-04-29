/**
 * Custom error classes and error handling utilities
 */

export enum ErrorType {
  NetworkError = "NETWORK_ERROR",
  AuthenticationError = "AUTHENTICATION_ERROR",
  AuthorizationError = "AUTHORIZATION_ERROR",
  ValidationError = "VALIDATION_ERROR",
  ServerError = "SERVER_ERROR",
  NotFoundError = "NOT_FOUND_ERROR",
  TimeoutError = "TIMEOUT_ERROR",
  UnknownError = "UNKNOWN_ERROR",
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
  timestamp?: string;
  isRetryable: boolean;
}

/**
 * Application error class with additional metadata
 */
export class AppError extends Error implements ErrorDetails {
  type: ErrorType;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
  timestamp?: string;
  isRetryable: boolean;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UnknownError,
    options?: {
      status?: number;
      code?: string;
      errors?: Record<string, string[]>;
      isRetryable?: boolean;
      timestamp?: string;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.status = options?.status;
    this.code = options?.code;
    this.errors = options?.errors;
    this.isRetryable = options?.isRetryable ?? this.getDefaultRetryable(type);
    this.timestamp = options?.timestamp;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getDefaultRetryable(type: ErrorType): boolean {
    // Network errors, timeouts, and some server errors are typically retryable
    return [ErrorType.NetworkError, ErrorType.TimeoutError].includes(type);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.type) {
      case ErrorType.NetworkError:
        return "Network connection failed. Please check your internet connection.";
      case ErrorType.AuthenticationError:
        return "Your session has expired. Please log in again.";
      case ErrorType.AuthorizationError:
        return "You do not have permission to access this resource.";
      case ErrorType.ValidationError:
        return "The provided data is invalid. Please check and try again.";
      case ErrorType.ServerError:
        return "An error occurred on the server. Please try again later.";
      case ErrorType.NotFoundError:
        return "The requested resource was not found.";
      case ErrorType.TimeoutError:
        return "The request took too long. Please try again.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }

  /**
   * Convert to serializable object
   */
  toJSON(): ErrorDetails {
    return {
      type: this.type,
      message: this.message,
      status: this.status,
      code: this.code,
      errors: this.errors,
      timestamp: this.timestamp,
      isRetryable: this.isRetryable,
    };
  }
}

/**
 * Validation error with field-specific errors
 */
export class ValidationError extends AppError {
  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, ErrorType.ValidationError, {
      errors,
      isRetryable: false,
    });
    this.name = "ValidationError";
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed") {
    super(message, ErrorType.AuthenticationError, {
      status: 401,
      isRetryable: false,
    });
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization/Permission error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, ErrorType.AuthorizationError, {
      status: 403,
      isRetryable: false,
    });
    this.name = "AuthorizationError";
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, ErrorType.NotFoundError, {
      status: 404,
      isRetryable: false,
    });
    this.name = "NotFoundError";
  }
}

/**
 * Network error
 */
export class NetworkError extends AppError {
  constructor(message: string = "Network request failed") {
    super(message, ErrorType.NetworkError, {
      isRetryable: true,
    });
    this.name = "NetworkError";
  }
}

/**
 * Server error
 */
export class ServerError extends AppError {
  constructor(message: string = "Server error", status?: number) {
    super(message, ErrorType.ServerError, {
      status,
      isRetryable: status && status >= 500 ? true : false,
    });
    this.name = "ServerError";
  }
}

/**
 * Convert HTTP status code to AppError
 */
export function createErrorFromStatus(
  status: number,
  message: string,
  data?: { code?: string; errors?: Record<string, string[]> },
): AppError {
  switch (status) {
    case 400:
      return new ValidationError(message, data?.errors);
    case 401:
      return new AuthenticationError(message);
    case 403:
      return new AuthorizationError(message);
    case 404:
      return new NotFoundError(message);
    case 408:
    case 504:
      return new AppError(message, ErrorType.TimeoutError, {
        status,
        isRetryable: true,
      });
    case 500:
    case 502:
    case 503:
      return new ServerError(message, status);
    default:
      if (status >= 500) {
        return new ServerError(message, status);
      }
      return new AppError(message, ErrorType.UnknownError, { status });
  }
}

/**
 * Check if error is of specific type
 */
export function isErrorType(error: any, type: ErrorType): boolean {
  return error instanceof AppError && error.type === type;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: any): boolean {
  if (error instanceof AppError) {
    return error.isRetryable;
  }
  return false;
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error?.message) {
    return error.message;
  }
  return "An unknown error occurred";
}

/**
 * Extract user-friendly message from error
 */
export function getUserFriendlyMessage(error: any): string {
  if (error instanceof AppError) {
    return error.getUserMessage();
  }
  return "An unexpected error occurred. Please try again.";
}
