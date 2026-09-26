import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../logger.service';
import { SensitiveDataSanitizer } from '../sanitizer/sensitive-data-sanitizer';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly isDevelopment: boolean;

  constructor(private readonly logger: LoggerService) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const method = request?.method;
    const path = request?.url;
    const requestId = (request as any)?.requestId;

    const handlerName = context.getHandler().name;
    const className = context.getClass().name;

    // Log handler start
    this.logger.debug(`Handler started: ${className}.${handlerName}`, {
      requestId,
      method,
      path,
      metadata: {
        handler: handlerName,
        className,
      },
    });

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - now;

        // Sanitize response in development
        let sanitizedResponse = response;
        if (this.isDevelopment) {
          sanitizedResponse = SensitiveDataSanitizer.sanitize(response);
        }

        this.logger.debug('Handler completed', {
          requestId,
          method,
          path,
          duration,
          metadata: {
            handler: handlerName,
            className,
            hasResponse: !!response,
          },
          responseBody: this.isDevelopment ? sanitizedResponse : undefined,
        });
      }),
      catchError((err) => {
        const duration = Date.now() - now;

        // Enrich error with context
        const errorCode = err.code || err.status || 'INTERNAL_ERROR';
        const causedBy =
          err.causedBy || err.cause?.message || err.stack?.split('\n')[0];

        this.logger.error('Handler threw error', {
          requestId,
          method,
          path,
          duration,
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            code: err.code,
          },
          errorCode,
          causedBy,
          metadata: {
            handler: handlerName,
            className,
            status: err.status,
            statusCode: err.statusCode,
          },
        });

        throw err;
      }),
    );
  }
}
