import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { LoggerService } from '../logger.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestIdHeader = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) ||
      randomUUID();
    (req as any).requestId = requestId;
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.info('HTTP request completed', {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userId: (req as any).user?.sub,
        companyId: (req as any).user?.companyId,
        duration,
      });
    });
    next();
  }
}
