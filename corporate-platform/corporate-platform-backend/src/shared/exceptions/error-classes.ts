import { DomainError, ErrorCodes } from './domain-error';

/**
 * Authentication & Authorization Errors
 */
export class InvalidCredentialsError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'InvalidCredentialsError',
      ErrorCodes.AUTH_001,
      'Invalid email or password',
      401,
      details,
    );
  }
}

export class UnauthorizedError extends DomainError {
  constructor(
    message = 'Unauthorized access',
    details?: Record<string, unknown>,
  ) {
    super('UnauthorizedError', ErrorCodes.AUTH_002, message, 401, details);
  }
}

export class InvalidTokenError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'InvalidTokenError',
      ErrorCodes.AUTH_003,
      'Invalid or expired token',
      401,
      details,
    );
  }
}

export class InsufficientPermissionsError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'InsufficientPermissionsError',
      ErrorCodes.AUTH_004,
      'Insufficient permissions to perform this action',
      403,
      details,
    );
  }
}

export class AccountLockedError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'AccountLockedError',
      ErrorCodes.AUTH_005,
      'Account is locked due to too many failed attempts',
      403,
      details,
    );
  }
}

export class AccountInactiveError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'AccountInactiveError',
      ErrorCodes.AUTH_006,
      'Account is inactive',
      403,
      details,
    );
  }
}

export class InvalidRefreshTokenError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'InvalidRefreshTokenError',
      ErrorCodes.AUTH_007,
      'Invalid refresh token',
      401,
      details,
    );
  }
}

export class SessionExpiredError extends DomainError {
  constructor(details?: Record<string, unknown>) {
    super(
      'SessionExpiredError',
      ErrorCodes.AUTH_008,
      'Session has expired',
      401,
      details,
    );
  }
}

/**
 * Validation Errors
 */
export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ValidationError', ErrorCodes.VALIDATION_001, message, 400, details);
  }
}

export class FieldValidationError extends DomainError {
  constructor(
    field: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super('FieldValidationError', ErrorCodes.VALIDATION_004, message, 400, {
      ...details,
      field,
    });
  }
}

/**
 * Not Found Errors
 */
export class ResourceNotFoundError extends DomainError {
  constructor(
    resource: string,
    identifier?: string,
    details?: Record<string, unknown>,
  ) {
    super(
      'ResourceNotFoundError',
      ErrorCodes.NOT_FOUND_001,
      `${resource} not found${identifier ? ` with identifier: ${identifier}` : ''}`,
      404,
      {
        resource,
        identifier,
        ...details,
      },
    );
  }
}

export class UserNotFoundError extends DomainError {
  constructor(identifier?: string, details?: Record<string, unknown>) {
    super(
      'UserNotFoundError',
      ErrorCodes.NOT_FOUND_002,
      `User not found${identifier ? ` with identifier: ${identifier}` : ''}`,
      404,
      {
        identifier,
        ...details,
      },
    );
  }
}

export class CreditNotFoundError extends DomainError {
  constructor(creditId: string, details?: Record<string, unknown>) {
    super(
      'CreditNotFoundError',
      ErrorCodes.NOT_FOUND_003,
      `Credit not found with ID: ${creditId}`,
      404,
      {
        creditId,
        ...details,
      },
    );
  }
}

export class CompanyNotFoundError extends DomainError {
  constructor(companyId: string, details?: Record<string, unknown>) {
    super(
      'CompanyNotFoundError',
      ErrorCodes.NOT_FOUND_004,
      `Company not found with ID: ${companyId}`,
      404,
      {
        companyId,
        ...details,
      },
    );
  }
}

export class RetirementNotFoundError extends DomainError {
  constructor(retirementId: string, details?: Record<string, unknown>) {
    super(
      'RetirementNotFoundError',
      ErrorCodes.NOT_FOUND_005,
      `Retirement not found with ID: ${retirementId}`,
      404,
      {
        retirementId,
        ...details,
      },
    );
  }
}

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string, details?: Record<string, unknown>) {
    super(
      'SessionNotFoundError',
      ErrorCodes.NOT_FOUND_006,
      `Session not found with ID: ${sessionId}`,
      404,
      {
        sessionId,
        ...details,
      },
    );
  }
}

/**
 * Conflict Errors
 */
export class ResourceConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'ResourceConflictError',
      ErrorCodes.CONFLICT_001,
      message,
      409,
      details,
    );
  }
}

export class EmailAlreadyInUseError extends DomainError {
  constructor(email: string, details?: Record<string, unknown>) {
    super(
      'EmailAlreadyInUseError',
      ErrorCodes.CONFLICT_002,
      `Email ${email} is already in use`,
      409,
      {
        email,
        ...details,
      },
    );
  }
}

export class CreditAlreadyRetiredError extends DomainError {
  constructor(creditId: string, details?: Record<string, unknown>) {
    super(
      'CreditAlreadyRetiredError',
      ErrorCodes.CONFLICT_003,
      `Credit ${creditId} has already been retired`,
      409,
      {
        creditId,
        ...details,
      },
    );
  }
}

export class UniqueConstraintViolationError extends DomainError {
  constructor(field: string, value: string, details?: Record<string, unknown>) {
    super(
      'UniqueConstraintViolationError',
      ErrorCodes.CONFLICT_005,
      `A record with ${field} '${value}' already exists`,
      409,
      {
        field,
        value,
        ...details,
      },
    );
  }
}

/**
 * Business Rule Errors
 */
export class InsufficientBalanceError extends DomainError {
  constructor(
    required: number,
    available: number,
    details?: Record<string, unknown>,
  ) {
    super(
      'InsufficientBalanceError',
      ErrorCodes.BUSINESS_001,
      `Insufficient balance: required ${required}, available ${available}`,
      400,
      {
        required,
        available,
        ...details,
      },
    );
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'BusinessRuleViolationError',
      ErrorCodes.BUSINESS_003,
      message,
      400,
      details,
    );
  }
}

export class InsufficientCreditsError extends DomainError {
  constructor(
    creditId: string,
    required: number,
    available: number,
    details?: Record<string, unknown>,
  ) {
    super(
      'InsufficientCreditsError',
      ErrorCodes.BUSINESS_004,
      `Insufficient credits for ${creditId}: required ${required}, available ${available}`,
      400,
      {
        creditId,
        required,
        available,
        ...details,
      },
    );
  }
}

export class CreditNotAvailableError extends DomainError {
  constructor(creditId: string, details?: Record<string, unknown>) {
    super(
      'CreditNotAvailableError',
      ErrorCodes.BUSINESS_006,
      `Credit ${creditId} is not available for retirement`,
      400,
      {
        creditId,
        ...details,
      },
    );
  }
}

export class InvalidRetirementAmountError extends DomainError {
  constructor(
    amount: number,
    minAmount?: number,
    maxAmount?: number,
    details?: Record<string, unknown>,
  ) {
    super(
      'InvalidRetirementAmountError',
      ErrorCodes.BUSINESS_007,
      `Invalid retirement amount: ${amount}`,
      400,
      {
        amount,
        minAmount,
        maxAmount,
        ...details,
      },
    );
  }
}

/**
 * Database Errors
 */
export class DatabaseError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('DatabaseError', ErrorCodes.DATABASE_001, message, 500, details);
  }
}

export class DatabaseRecordNotFoundError extends DomainError {
  constructor(table: string, id?: string, details?: Record<string, unknown>) {
    super(
      'DatabaseRecordNotFoundError',
      ErrorCodes.DATABASE_002,
      `Record not found in ${table}${id ? ` with ID: ${id}` : ''}`,
      404,
      {
        table,
        id,
        ...details,
      },
    );
  }
}

/**
 * External Service Errors
 */
export class ExternalServiceError extends DomainError {
  constructor(
    service: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(
      'ExternalServiceError',
      ErrorCodes.EXTERNAL_001,
      `${service} error: ${message}`,
      503,
      {
        service,
        ...details,
      },
    );
  }
}

export class StellarError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'StellarError',
      ErrorCodes.EXTERNAL_002,
      `Stellar network error: ${message}`,
      503,
      details,
    );
  }
}

export class IpfsError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'IpfsError',
      ErrorCodes.EXTERNAL_003,
      `IPFS error: ${message}`,
      503,
      details,
    );
  }
}

/**
 * Internal Errors
 */
export class InternalServerError extends DomainError {
  constructor(
    message = 'An internal server error occurred',
    details?: Record<string, unknown>,
  ) {
    super(
      'InternalServerError',
      ErrorCodes.INTERNAL_001,
      message,
      500,
      details,
    );
  }
}

export class UnexpectedError extends DomainError {
  constructor(
    message = 'An unexpected error occurred',
    details?: Record<string, unknown>,
  ) {
    super('UnexpectedError', ErrorCodes.INTERNAL_002, message, 500, details);
  }
}
