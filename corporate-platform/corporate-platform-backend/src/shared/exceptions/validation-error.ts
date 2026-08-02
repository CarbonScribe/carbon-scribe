import { DomainError, ErrorCodes } from './domain-error';

/**
 * Event validation error
 */
export class EventValidationError extends DomainError {
  constructor(
    message: string,
    errors: Array<{ field: string; message: string }>,
  ) {
    super('EventValidationError', ErrorCodes.VALIDATION_002, message, 400, {
      errors,
    });
  }
}
