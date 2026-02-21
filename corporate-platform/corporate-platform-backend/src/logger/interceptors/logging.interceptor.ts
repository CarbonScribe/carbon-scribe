import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const method = request?.method;
    const path = request?.url;
    const requestId = (request as any)?.requestId;
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.debug('Handler completed', {
          requestId,
          method,
          path,
          duration,
          metadata: {
            handler: context.getHandler().name,
            className: context.getClass().name,
          },
        });
      }),
      catchError((err) => {
        const duration = Date.now() - now;
        this.logger.error('Handler threw error', {
          requestId,
          method,
          path,
          duration,
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
          metadata: {
            handler: context.getHandler().name,
            className: context.getClass().name,
          },
        });
        throw err;
      }),
    );
  }
}
