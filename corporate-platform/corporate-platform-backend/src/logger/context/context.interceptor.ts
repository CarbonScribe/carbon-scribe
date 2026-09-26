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

    // Extract or generate trace ID from headers (W3C Trace Context)
    const traceId =
      (request.headers['traceparent'] as string)?.split('-')[1] ||
      (request.headers['x-trace-id'] as string) ||
      randomUUID();

    // Generate span ID
    const spanId = randomUUID().slice(0, 16);

    // Get request ID from header or generate
    const requestIdHeader = request.headers['x-request-id'];
    const requestId =
      (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) ||
      randomUUID();

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
