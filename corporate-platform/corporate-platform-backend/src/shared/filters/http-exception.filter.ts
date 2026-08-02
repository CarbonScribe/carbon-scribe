import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../exceptions/domain-error';
import { LoggerService } from '../../logger/logger.service';
import { Prisma } from '@prisma/client';

/**
 * Standardized error response envelope
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    path?: string;
    method?: string;
  };
}

/**
 * Global HTTP exception filter that catches all exceptions and transforms them
 * into consistent error responses.
 *
 * Features:
 * - Maps domain errors to HTTP status codes
 * - Translates Prisma errors to domain errors
 * - Formats validation errors with field details
 * - Logs errors with request context
 * - Hides stack traces in production
 * - Distinguishes client (4xx) vs server (5xx) errors
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly isDevelopment: boolean;

  constructor(private readonly logger: LoggerService) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Main exception handler
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Build request context for logging
    const requestContext = this.buildRequestContext(request);

    // Determine if this is a known error type
    let errorResponse: ErrorResponse;
    let statusCode: number;

    if (exception instanceof DomainError) {
      // Handle domain errors
      const domainError = exception as DomainError;
      statusCode = domainError.statusCode;
      errorResponse = this.formatDomainError(domainError, request);
    } else if (exception instanceof BadRequestException) {
      // Handle NestJS validation errors
      statusCode = HttpStatus.BAD_REQUEST;
      errorResponse = this.formatNestValidationError(exception, request);
    } else if (exception instanceof HttpException) {
      // Handle other NestJS HTTP exceptions
      statusCode = exception.getStatus();
      errorResponse = this.formatHttpException(exception, request);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors
      const translated = this.translatePrismaError(exception);
      statusCode = translated.statusCode;
      errorResponse = this.formatDomainError(translated, request);
    } else {
      // Handle unknown errors
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = this.formatUnknownError(exception, request);
    }

    // Log the error with context
    this.logError(exception, statusCode, requestContext, errorResponse);

    // Send response (hide stack in production)
    const responseBody = this.isDevelopment
      ? {
          ...errorResponse,
          stack: exception instanceof Error ? exception.stack : undefined,
        }
      : errorResponse;

    response.status(statusCode).json(responseBody);
  }

  /**
   * Build request context for logging
   */
  private buildRequestContext(request: Request): {
    userId?: string;
    companyId?: string;
    requestId?: string;
    ip?: string;
    method: string;
    path: string;
  } {
    const userId = (request as any).user?.id || (request as any).userId;
    const companyId =
      (request as any).companyId || (request as any).company?.id;
    const requestId = (request as any).requestId;

    return {
      userId,
      companyId,
      requestId,
      ip: request.ip || (request.headers['x-forwarded-for'] as string),
      method: request.method,
      path: request.url,
    };
  }

  /**
   * Format a domain error into a consistent error response
   */
  private formatDomainError(
    error: DomainError,
    request: Request,
  ): ErrorResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
        path: request.url,
        method: request.method,
      },
    };
  }

  /**
   * Format a NestJS validation error with field-specific details
   */
  private formatNestValidationError(
    exception: BadRequestException,
    request: Request,
  ): ErrorResponse {
    const response = exception.getResponse() as any;
    const message = response.message || 'Validation failed';
    const details: Record<string, unknown> = {};

    // Extract field-specific validation errors
    if (Array.isArray(response.message)) {
      details.fields = response.message;
    } else if (typeof response.message === 'object') {
      details.fields = response.message;
    }

    return {
      success: false,
      error: {
        code: 'VALIDATION_001',
        message: typeof message === 'string' ? message : 'Validation failed',
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };
  }

  /**
   * Format a NestJS HTTP exception
   */
  private formatHttpException(
    exception: HttpException,
    request: Request,
  ): ErrorResponse {
    const status = exception.getStatus();
    const response = exception.getResponse() as any;

    return {
      success: false,
      error: {
        code: `HTTP_${status}`,
        message:
          typeof response === 'string'
            ? response
            : response.message || exception.message,
        details:
          typeof response === 'object' && response !== null
            ? response
            : undefined,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };
  }

  /**
   * Format an unknown error (fallback)
   */
  private formatUnknownError(
    exception: unknown,
    request: Request,
  ): ErrorResponse {
    const message =
      exception instanceof Error
        ? exception.message
        : 'An unexpected error occurred';

    return {
      success: false,
      error: {
        code: 'INTERNAL_002',
        message: this.isDevelopment
          ? message
          : 'An internal server error occurred',
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    };
  }

  /**
   * Translate Prisma known request errors to domain errors
   */
  private translatePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
  ): DomainError {
    const { code, meta } = error;

    // P2025: Record not found
    if (code === 'P2025') {
      const model = (meta as any)?.modelName || 'Record';
      return new (class extends DomainError {
        constructor() {
          super(
            'DatabaseRecordNotFoundError',
            'DATABASE_002',
            `${model} not found`,
            404,
            { model, prismaError: code },
          );
        }
      })();
    }

    // P2002: Unique constraint violation
    if (code === 'P2002') {
      const target = (meta as any)?.target || 'field';
      return new (class extends DomainError {
        constructor() {
          super(
            'UniqueConstraintViolationError',
            'CONFLICT_005',
            `A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists`,
            409,
            { field: target, prismaError: code },
          );
        }
      })();
    }

    // P2003: Foreign key constraint violation
    if (code === 'P2003') {
      return new (class extends DomainError {
        constructor() {
          super(
            'ForeignKeyConstraintError',
            'DATABASE_004',
            'Related record not found',
            400,
            { prismaError: code, meta },
          );
        }
      })();
    }

    // P2014: Relation constraint violation
    if (code === 'P2014') {
      return new (class extends DomainError {
        constructor() {
          super(
            'RelationConstraintError',
            'CONFLICT_004',
            'Invalid relation operation',
            409,
            { prismaError: code, meta },
          );
        }
      })();
    }

    // Default database error
    return new (class extends DomainError {
      constructor() {
        super(
          'DatabaseError',
          'DATABASE_001',
          `Database operation failed: ${error.message}`,
          500,
          { prismaError: code, meta },
        );
      }
    })();
  }

  /**
   * Log error with request context
   */
  private logError(
    exception: unknown,
    statusCode: number,
    context: {
      userId?: string;
      companyId?: string;
      requestId?: string;
      ip?: string;
      method: string;
      path: string;
    },
    errorResponse: ErrorResponse,
  ): void {
    const isClientError = statusCode >= 400 && statusCode < 500;
    const level = isClientError ? 'warn' : 'error';
    const error =
      exception instanceof Error ? exception : new Error(String(exception));

    // Build log metadata
    const metadata: Record<string, unknown> = {
      statusCode,
      path: context.path,
      method: context.method,
      ip: context.ip,
      userId: context.userId,
      companyId: context.companyId,
      requestId: context.requestId,
      errorCode: errorResponse.error.code,
      errorMessage: errorResponse.error.message,
    };

    if (this.isDevelopment && exception instanceof Error) {
      metadata.stack = exception.stack;
    }

    // Log with appropriate level
    if (level === 'error') {
      this.logger.error(
        `[HTTP Error] ${errorResponse.error.code}: ${errorResponse.error.message}`,
        {
          ...metadata,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
      );
    } else {
      this.logger.warn(
        `[HTTP Error] ${errorResponse.error.code}: ${errorResponse.error.message}`,
        metadata,
      );
    }

    // Special logging for 5xx errors (should trigger alerts)
    if (statusCode >= 500) {
      this.logger.fatal(`Server error at ${context.method} ${context.path}`, {
        ...metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
        },
      });
    }
  }
}
