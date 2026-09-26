import { Injectable, Logger } from '@nestjs/common';
import * as Joi from 'joi';
import { Event } from './interfaces/event.interface';
import { baseEventSchema, validationOptions, getEventSchema } from './schemas';
import { ConfigService } from '../config/config.service';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: string[];
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  type: string;
  value?: unknown;
}

/**
 * Event validation metrics
 */
interface ValidationMetrics {
  totalValidated: number;
  validCount: number;
  invalidCount: number;
  byEventType: Map<string, { total: number; invalid: number }>;
}

/**
 * Event Validator Service
 *
 * Features:
 * - Runtime schema validation using Joi
 * - Required field enforcement
 * - Payload structure validation
 * - Version compatibility checks
 * - Validation failure logging
 * - Metrics tracking
 */
@Injectable()
export class EventValidatorService {
  private readonly logger = new Logger(EventValidatorService.name);
  private readonly isDevelopment: boolean;
  private readonly metrics: ValidationMetrics = {
    totalValidated: 0,
    validCount: 0,
    invalidCount: 0,
    byEventType: new Map(),
  };

  constructor(private readonly configService: ConfigService) {
    const appConfig = this.configService.getAppConfig();
    this.isDevelopment = appConfig.nodeEnv === 'development';
  }

  /**
   * Validate a single event
   * @throws {Error} if validation fails and throwOnError is true
   */
  validate<T = unknown>(
    event: Event<T>,
    options: { throwOnError?: boolean } = { throwOnError: false },
  ): ValidationResult {
    this.metrics.totalValidated++;

    try {
      // Step 1: Validate base event fields
      const baseValidation = baseEventSchema.validate(event, validationOptions);
      if (baseValidation.error) {
        const errors = this.formatJoiErrors(baseValidation.error);
        this.logValidationFailure(event, errors);
        this.updateMetrics(event.type, false);
        return { valid: false, errors };
      }

      // Step 2: Get event-specific schema
      const eventSchema = getEventSchema(event.type);
      if (!eventSchema) {
        const warning = `No schema registered for event type: ${event.type}`;
        this.logger.warn(warning, { eventId: event.id, eventType: event.type });
        // Allow events without schemas but log warning
        this.updateMetrics(event.type, true);
        return { valid: true, warnings: [warning] };
      }

      // Step 3: Validate against event-specific schema
      const eventValidation = eventSchema.validate(event, validationOptions);
      if (eventValidation.error) {
        const errors = this.formatJoiErrors(eventValidation.error);
        this.logValidationFailure(event, errors);
        this.updateMetrics(event.type, false);
        if (options.throwOnError) {
          throw new Error(`Event validation failed: ${JSON.stringify(errors)}`);
        }
        return { valid: false, errors };
      }

      // Step 4: Additional validation - version format
      const versionValid = this.validateVersion(event.version);
      if (!versionValid) {
        const errors: ValidationError[] = [
          {
            field: 'version',
            message: 'Event version must be in semver format (e.g., 1.0.0)',
            type: 'string.pattern.base',
            value: event.version,
          },
        ];
        this.logValidationFailure(event, errors);
        this.updateMetrics(event.type, false);
        if (options.throwOnError) {
          throw new Error(`Event validation failed: ${JSON.stringify(errors)}`);
        }
        return { valid: false, errors };
      }

      this.updateMetrics(event.type, true);
      this.logger.debug(`Event ${event.id} validated successfully`, {
        eventType: event.type,
        eventVersion: event.version,
      });

      return { valid: true };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Validation error for event ${event.id}: ${err.message}`,
      );
      this.updateMetrics(event.type, false);

      if (options.throwOnError) {
        throw err;
      }

      return {
        valid: false,
        errors: [
          {
            field: '_global',
            message: err.message,
            type: 'validation.error',
            value: undefined,
          },
        ],
      };
    }
  }

  /**
   * Validate multiple events (batch)
   */
  validateBatch<T = unknown>(
    events: Event<T>[],
    options: { throwOnError?: boolean } = { throwOnError: false },
  ): ValidationResult[] {
    return events.map((event) => this.validate(event, options));
  }

  /**
   * Validate event and throw on failure
   */
  validateOrThrow<T = unknown>(event: Event<T>): void {
    const result = this.validate(event, { throwOnError: false });
    if (!result.valid) {
      const errorMessages = result.errors
        ?.map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      throw new Error(`Event validation failed: ${errorMessages}`);
    }
  }

  /**
   * Validate multiple events and throw on first failure
   */
  validateBatchOrThrow<T = unknown>(events: Event<T>[]): void {
    for (const event of events) {
      this.validateOrThrow(event);
    }
  }

  /**
   * Check if event is valid (returns boolean)
   */
  isValid<T = unknown>(event: Event<T>): boolean {
    const result = this.validate(event);
    return result.valid;
  }

  /**
   * Get validation metrics
   */
  getMetrics(): {
    totalValidated: number;
    validCount: number;
    invalidCount: number;
    byEventType: Record<string, { total: number; invalid: number }>;
    invalidRate: number;
  } {
    const byEventType: Record<string, { total: number; invalid: number }> = {};
    for (const [type, metrics] of this.metrics.byEventType) {
      byEventType[type] = {
        total: metrics.total,
        invalid: metrics.invalid,
      };
    }

    return {
      totalValidated: this.metrics.totalValidated,
      validCount: this.metrics.validCount,
      invalidCount: this.metrics.invalidCount,
      byEventType,
      invalidRate:
        this.metrics.totalValidated > 0
          ? this.metrics.invalidCount / this.metrics.totalValidated
          : 0,
    };
  }

  /**
   * Reset validation metrics
   */
  resetMetrics(): void {
    this.metrics.totalValidated = 0;
    this.metrics.validCount = 0;
    this.metrics.invalidCount = 0;
    this.metrics.byEventType.clear();
  }

  /**
   * Format Joi validation errors
   */
  private formatJoiErrors(error: Joi.ValidationError): ValidationError[] {
    return error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
      value: detail.context?.value,
    }));
  }

  /**
   * Log validation failure with context
   */
  private logValidationFailure<T = unknown>(
    event: Event<T>,
    errors: ValidationError[],
  ): void {
    const errorDetails = {
      eventId: event.id,
      eventType: event.type,
      eventVersion: event.version,
      errors: errors.map((e) => `${e.field}: ${e.message}`),
      correlationId: event.correlationId,
      companyId: event.companyId,
      userId: event.userId,
    };

    if (this.isDevelopment) {
      this.logger.warn(`Event validation failed for ${event.type}`, {
        ...errorDetails,
        eventData: event.data,
      });
    } else {
      this.logger.warn(`Event validation failed for ${event.type}`, {
        ...errorDetails,
      });
    }
  }

  /**
   * Update validation metrics
   */
  private updateMetrics(eventType: string, isValid: boolean): void {
    if (isValid) {
      this.metrics.validCount++;
    } else {
      this.metrics.invalidCount++;
    }

    if (!this.metrics.byEventType.has(eventType)) {
      this.metrics.byEventType.set(eventType, { total: 0, invalid: 0 });
    }

    const metrics = this.metrics.byEventType.get(eventType)!;
    metrics.total++;
    if (!isValid) {
      metrics.invalid++;
    }
  }

  /**
   * Validate version format (semver)
   */
  private validateVersion(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * Check version compatibility
   * Event version 1.2.0 is compatible with consumer expecting 1.x.x
   */
  isVersionCompatible(eventVersion: string, consumerVersion: string): boolean {
    try {
      const [eventMajor] = eventVersion.split('.').map(Number);
      const [consumerMajor] = consumerVersion.split('.').map(Number);
      return eventMajor === consumerMajor;
    } catch {
      return false;
    }
  }
}
