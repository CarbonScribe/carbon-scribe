import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../security.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  constructor(private readonly securityService: SecurityService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const user = req.user as JwtPayload | undefined;

      this.securityService.logEvent({
        eventType: 'http.request' as any,
        companyId: user?.companyId,
        userId: user?.sub,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        resource: req.originalUrl || req.url,
        method: req.method,
        details: {
          duration,
        },
        status: res.statusCode >= 400 ? 'failure' : 'success',
        statusCode: res.statusCode,
      });
    });

    next();
  }
}
