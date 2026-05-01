/**
 * Enhanced Error Handling Utilities with Actionable Feedback
 * 
 * Provides structured error types, actionable messages, and recovery suggestions
 * for consistent user experience across the application.
 */

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export type ErrorCategory = 
  | 'network'           // Connection, timeout, offline
  | 'authentication'    // Session expired, unauthorized
  | 'validation'        // Invalid input, missing fields
  | 'permission'        // Access denied, forbidden
  | 'not_found'         // Resource doesn't exist
  | 'server'            // Internal server error, bad gateway
  | 'rate_limit'        // Too many requests
  | 'conflict'          // Duplicate entry, version conflict
  | 'business_logic'    // Domain-specific errors
  | 'unknown';          // Fallback for unhandled errors

export interface ActionableError {
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  
  // Actionable feedback
  description?: string;
  troubleshootingTip?: string;
  retryable: boolean;
  
  // Optional actions
  retryAction?: () => void;
  supportLink?: string;
  documentationLink?: string;
  
  // Metadata
  statusCode?: number;
  errorCode?: string;
  timestamp: Date;
}

/**
 * Error message templates for different error categories
 */
export const ERROR_MESSAGES: Record<ErrorCategory, {
  title: string;
  description: string;
  troubleshooting: string;
  supportLink?: string;
}> = {
  network: {
    title: 'Connection Error',
    description: 'Unable to connect to the server. Please check your internet connection.',
    troubleshooting: 'Try refreshing the page or check if you\'re offline. If the problem persists, wait a few minutes and try again.',
    supportLink: '/support/network-issues',
  },
  authentication: {
    title: 'Authentication Required',
    description: 'Your session has expired or you need to sign in.',
    troubleshooting: 'Please sign in again to continue. If you\'re already signed in, try refreshing the page.',
    supportLink: '/support/authentication',
  },
  validation: {
    title: 'Validation Error',
    description: 'Please check your input and try again.',
    troubleshooting: 'Review the form fields for any errors. All required fields must be filled correctly.',
  },
  permission: {
    title: 'Access Denied',
    description: 'You don\'t have permission to perform this action.',
    troubleshooting: 'Contact your administrator if you believe you should have access to this feature.',
    supportLink: '/support/permissions',
  },
  not_found: {
    title: 'Not Found',
    description: 'The requested resource could not be found.',
    troubleshooting: 'The item may have been deleted or the URL might be incorrect. Try navigating from the main menu.',
  },
  server: {
    title: 'Server Error',
    description: 'An unexpected error occurred on our servers.',
    troubleshooting: 'This is not your fault. Please try again in a moment. If the issue persists, contact support.',
    supportLink: '/support/server-errors',
  },
  rate_limit: {
    title: 'Too Many Requests',
    description: 'You\'ve made too many requests. Please wait a moment.',
    troubleshooting: 'Wait a few seconds before trying again. If you\'re using automated tools, reduce the request frequency.',
  },
  conflict: {
    title: 'Conflict Detected',
    description: 'This action conflicts with existing data.',
    troubleshooting: 'The data may have been modified by someone else. Refresh and try again.',
  },
  business_logic: {
    title: 'Operation Failed',
    description: 'The requested operation could not be completed.',
    troubleshooting: 'Please review the requirements and try again. Contact support if you need assistance.',
  },
  unknown: {
    title: 'Unexpected Error',
    description: 'An unexpected error occurred.',
    troubleshooting: 'Please try again. If the problem persists, contact our support team.',
    supportLink: '/support',
  },
};

/**
 * Categorize an error based on HTTP status or error type
 */
export function categorizeError(error: unknown, statusCode?: number): ErrorCategory {
  if (statusCode) {
    switch (statusCode) {
      case 400: return 'validation';
      case 401: return 'authentication';
      case 403: return 'permission';
      case 404: return 'not_found';
      case 409: return 'conflict';
      case 429: return 'rate_limit';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'server';
      default:
        if (statusCode >= 400 && statusCode < 500) return 'validation';
        if (statusCode >= 500) return 'server';
        return 'unknown';
    }
  }

  // Categorize based on error type/message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('unauthorized') || message.includes('auth')) {
      return 'authentication';
    }
    if (message.includes('forbidden') || message.includes('permission')) {
      return 'permission';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'not_found';
    }
  }

  return 'unknown';
}

/**
 * Determine error severity based on category
 */
export function getErrorSeverity(category: ErrorCategory): ErrorSeverity {
  switch (category) {
    case 'network':
    case 'server':
      return 'error';
    case 'authentication':
    case 'permission':
      return 'critical';
    case 'validation':
    case 'conflict':
      return 'warning';
    case 'rate_limit':
      return 'info';
    default:
      return 'error';
  }
}

/**
 * Create an actionable error object from any error
 */
export function createActionableError(
  error: unknown,
  options?: {
    category?: ErrorCategory;
    statusCode?: number;
    customMessage?: string;
    retryAction?: () => void;
    errorCode?: string;
  }
): ActionableError {
  const statusCode = options?.statusCode || (error as any)?.response?.status;
  const category = options?.category || categorizeError(error, statusCode);
  const messageTemplate = ERROR_MESSAGES[category];

  return {
    message: options?.customMessage || messageTemplate.title,
    severity: getErrorSeverity(category),
    category,
    description: messageTemplate.description,
    troubleshootingTip: messageTemplate.troubleshooting,
    retryable: ['network', 'server', 'rate_limit', 'conflict'].includes(category),
    retryAction: options?.retryAction,
    supportLink: messageTemplate.supportLink,
    statusCode,
    errorCode: options?.errorCode,
    timestamp: new Date(),
  };
}

/**
 * Extract user-friendly error message from API error response
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) {
    // Check for API response data
    const apiError = error as any;
    if (apiError.response?.data?.message) {
      return apiError.response.data.message;
    }
    if (apiError.response?.data?.error) {
      return apiError.response.data.error;
    }
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as any;
    if (errObj.message) return errObj.message;
    if (errObj.error) return errObj.error;
  }

  return 'An unexpected error occurred';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const category = categorizeError(error);
  return ['network', 'server', 'rate_limit', 'conflict'].includes(category);
}
