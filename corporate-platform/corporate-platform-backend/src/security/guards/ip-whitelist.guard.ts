import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { SecurityService } from '../security.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SecurityEvents } from '../constants/security-events.constants';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(private readonly securityService: SecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    const user = request.user as JwtPayload | undefined;
    const companyId = user?.companyId ?? null;
    const clientIp =
      (request.headers['x-forwarded-for'] as string) || (request.ip as string);

    const overrideToken = process.env.ADMIN_SECURITY_OVERRIDE_TOKEN;
    const adminOverride =
      request.headers['x-admin-override'] &&
      request.headers['x-admin-override'] === overrideToken;

    if (adminOverride) {
      return true;
    }

    const allowed = await this.securityService.isIpAllowed(companyId, clientIp);

    if (!allowed) {
      await this.securityService.logEvent({
        eventType: SecurityEvents.IpBlocked,
        companyId: companyId ?? undefined,
        userId: user?.sub,
        ipAddress: clientIp,
        userAgent: request.headers['user-agent'] as string,
        resource: request.originalUrl || request.url,
        method: request.method,
        status: 'blocked',
        statusCode: 403,
      });
      throw new ForbiddenException('IP not allowed');
    }

    return true;
  }
}
