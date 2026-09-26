import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggerService } from '../logger.service';
import { RequestContext } from '../context/request-context';
import { SensitiveDataSanitizer } from '../sanitizer/sensitive-data-sanitizer';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly isDevelopment: boolean;
  private readonly enableBodyLogging: boolean;

  constructor(private readonly logger: LoggerService) {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.enableBodyLogging =
      process.env.LOG_BODIES === 'true' || this.isDevelopment;
  }

  use(req: Request, res: Response, next: NextFunction) {
    const requestIdHeader = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) ||
      randomUUID();

    // Store request ID on request object
    (req as any).requestId = requestId;

    // Extract trace ID from W3C Trace Context header
    const traceParent = req.headers['traceparent'] as string;
    const traceId =
      traceParent?.split('-')[1] ||
      (req.headers['x-trace-id'] as string) ||
      randomUUID();

    // Set request context
    const context = RequestContext.get();
    if (context) {
      context.requestId = requestId;
      context.traceId = traceId;
      context.method = req.method;
      context.path = req.path || req.url;
      context.ip = req.ip || req.connection?.remoteAddress;
      context.userAgent = req.headers['user-agent'] as string;
      context.referer = req.headers['referer'] as string;

      // Extract API version
      const match = req.path?.match(/\/api\/(v\d+)\//);
      if (match) {
        context.apiVersion = match[1];
      }
    }

    // Log request body in development
    let requestBody: any;
    if (this.isDevelopment && this.enableBodyLogging && req.body) {
      requestBody = SensitiveDataSanitizer.sanitize(req.body);
    }

    const start = Date.now();

    // Capture response body in development
    let responseBody: any;
    const originalJson = res.json;
    res.json = function (body: any) {
      if (this.isDevelopment && this.enableBodyLogging) {
        responseBody = SensitiveDataSanitizer.sanitize(body);
      }
      return originalJson.call(this, body);
    }.bind({
      isDevelopment: this.isDevelopment,
      enableBodyLogging: this.enableBodyLogging,
    });

    res.on('finish', () => {
      const duration = Date.now() - start;

      // Log the request
      this.logger.info('HTTP request completed', {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userId: (req as any).user?.sub || (req as any).user?.id,
        companyId: (req as any).user?.companyId || (req as any).user?.tenantId,
        duration,
        userAgent: req.headers['user-agent'] as string,
        referer: req.headers['referer'] as string,
        requestBody: this.isDevelopment ? requestBody : undefined,
        responseBody: this.isDevelopment ? responseBody : undefined,
        metadata: {
          contentLength: res.get('content-length'),
          contentType: res.get('content-type'),
        },
      });
    });

    next();
  }
}
