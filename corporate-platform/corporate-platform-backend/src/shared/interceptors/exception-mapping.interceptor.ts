import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DomainError } from '../exceptions/domain-error';
import { Prisma } from '@prisma/client';
import {
  ResourceNotFoundError,
  UniqueConstraintViolationError,
  DatabaseError,
} from '../exceptions/error-classes';

/**
 * Interceptor that maps domain errors and other exceptions to appropriate responses
 * before they reach the global exception filter.
 *
 * This interceptor provides an additional layer of error transformation,
 * ensuring that domain errors are properly structured and Prisma errors
 * are translated before being handled by the global filter.
 */
@Injectable()
export class ExceptionMappingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        // If it's already a domain error, let it through
        if (error instanceof DomainError) {
          return throwError(() => error);
        }

        // Translate Prisma errors
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const translated = this.translatePrismaError(error);
          return throwError(() => translated);
        }

        // Pass through NestJS HTTP exceptions as-is
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Wrap unknown errors
        const wrapped = this.wrapUnknownError(error);
        return throwError(() => wrapped);
      }),
    );
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
      const id = (meta as any)?.id;
      return new ResourceNotFoundError(model, id, { prismaError: code });
    }

    // P2002: Unique constraint violation
    if (code === 'P2002') {
      const target = (meta as any)?.target || 'field';
      const field = Array.isArray(target) ? target.join(', ') : target;
      return new UniqueConstraintViolationError(field, 'unknown', {
        prismaError: code,
      });
    }

    // P2003: Foreign key constraint violation
    if (code === 'P2003') {
      const field = (meta as any)?.field_name || 'foreign key';
      return new ResourceNotFoundError('Related record', undefined, {
        field,
        prismaError: code,
      });
    }

    // Default database error
    return new DatabaseError(`Database operation failed: ${error.message}`, {
      prismaError: code,
      meta,
    });
  }

  /**
   * Wrap unknown errors
   */
  private wrapUnknownError(error: unknown): DomainError {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    const details =
      error instanceof Error
        ? { stack: error.stack }
        : { error: String(error) };

    return new (class extends DomainError {
      constructor() {
        super(
          'UnexpectedError',
          'INTERNAL_002',
          message,
          HttpStatus.INTERNAL_SERVER_ERROR,
          details,
        );
      }
    })();
  }
}
