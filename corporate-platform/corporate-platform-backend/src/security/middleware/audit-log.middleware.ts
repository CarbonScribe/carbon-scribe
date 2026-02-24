import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../security.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SecurityEvents } from '../constants/security-events.constants';

type RequestWithUser = Request & { user?: JwtPayload };

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  constructor(private readonly securityService: SecurityService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const request = req as RequestWithUser;
    const user = request.user;
    const companyId = user?.companyId;
    const ipAddress =
      (request.headers['x-forwarded-for'] as string) || (request.ip as string);
    const userAgent = request.headers['user-agent'] as string;
    const resource = request.originalUrl || request.url;
    const method = request.method;

    res.on('finish', () => {
      this.securityService.logEvent({
        eventType: SecurityEvents.AuditLog,
        companyId,
        userId: user?.sub,
        ipAddress,
        userAgent,
        resource,
        method,
        status: res.statusCode >= 400 ? 'error' : 'success',
        statusCode: res.statusCode,
      });
    });

    next();
  }
}

