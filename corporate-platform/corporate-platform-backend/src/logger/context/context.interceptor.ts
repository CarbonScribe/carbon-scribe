import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { RequestContext, RequestContextData } from './request-context';
import { LoggerService } from '../logger.service';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    // Prefer the IDs RequestLoggerMiddleware already resolved (it runs
    // before this interceptor) so the ID a client sees echoed back in the
    // x-request-id/x-trace-id response headers is the exact same one
    // threaded through RequestContext here — not a second, independently
    // generated value derived from the same headers (#736). Falls back to
    // deriving them directly in case this interceptor is ever used on a
    // route where that middleware isn't applied.
    const requestId =
      (request as any).requestId ||
      (() => {
        const requestIdHeader = request.headers['x-request-id'];
        return (
          (Array.isArray(requestIdHeader)
            ? requestIdHeader[0]
            : requestIdHeader) || randomUUID()
        );
      })();

    const traceId =
      (request as any).traceId ||
      (request.headers['traceparent'] as string)?.split('-')[1] ||
      (request.headers['x-trace-id'] as string) ||
      randomUUID();

    // Generate span ID
    const spanId = randomUUID().slice(0, 16);

    // Extract user from request
    const user = (request as any).user;
    const apiVersion = this.extractApiVersion(request.path);

    const contextData: RequestContextData = {
      requestId,
      traceId,
      spanId,
      userId: user?.sub || user?.id,
      companyId: user?.companyId || user?.tenantId,
      userEmail: user?.email,
      userRole: user?.role,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'] as string,
      referer: request.headers['referer'] as string,
      method: request.method,
      path: request.path || request.url,
      apiVersion,
    };

    // Store in AsyncLocalStorage
    return new Observable((observer) => {
      RequestContext.run(contextData, () => {
        next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      });
    });
  }

  private extractApiVersion(path: string): string | undefined {
    const match = path?.match(/\/api\/(v\d+)\//);
    return match ? match[1] : undefined;
  }
}
