import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from '../../config/config.service';

/**
 * Request timeout interceptor that cancels upstream calls when HTTP request times out
 *
 * Features:
 * - Configurable request timeout
 * - Propagates cancellation to upstream calls
 * - AbortController support for HTTP requests
 */
@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const timeoutConfig = this.configService.getTimeoutConfig();
    this.timeoutMs = timeoutConfig?.defaultTimeout || 30000;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    // Create AbortController for request cancellation
    const abortController = new AbortController();
    request.abortSignal = abortController.signal;

    // Set timeout to abort the request
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeoutMs);

    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: Error) => {
        clearTimeout(timeoutId);

        if (error.name === 'TimeoutError') {
          return throwError(
            () => new RequestTimeoutException('Request timed out'),
          );
        }

        if (
          error.message?.includes('cancelled') ||
          error.message?.includes('aborted')
        ) {
          return throwError(
            () => new RequestTimeoutException('Request cancelled'),
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
