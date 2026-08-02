import { DomainError, ErrorCodes } from './domain-error';

/**
 * Timeout error for upstream calls
 */
export class TimeoutError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('TimeoutError', ErrorCodes.TIMEOUT_001, message, 504, details);
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends DomainError {
  constructor(service: string, details?: Record<string, unknown>) {
    super(
      'CircuitBreakerOpenError',
      ErrorCodes.CIRCUIT_001,
      `Circuit breaker open for service: ${service}`,
      503,
      {
        service,
        ...details,
      },
    );
  }
}
