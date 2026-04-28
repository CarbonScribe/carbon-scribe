import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AuditTrailService } from '../audit-trail.service';
import {
  AuditAction,
  AuditEventType,
} from '../interfaces/audit-event.interface';

@Injectable()
export class ComplianceAuditMiddleware implements NestMiddleware {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const shouldCapture = this.shouldCaptureRequest(req);
    if (!shouldCapture) {
      next();
      return;
    }

    res.on('finish', () => {
      const user = req.user as JwtPayload | undefined;
      if (!user?.companyId || !user?.sub) {
        return;
      }

      const eventType = this.resolveEventType(req.originalUrl || req.url);
      const action = this.resolveAction(req.method);
      const entityType = this.resolveEntityType(req.originalUrl || req.url);
      const entityId = this.resolveEntityId(req);

      void this.auditTrailService.createAuditEvent(
        user.companyId,
        user.sub,
        {
          eventType,
          action,
          entityType,
          entityId,
          newState: req.body,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string,
            requestId: (req.headers['x-request-id'] as string) || undefined,
            resource: req.originalUrl || req.url,
            method: req.method,
            statusCode: res.statusCode,
          },
        },
        {},
      );
    });

    next();
  }

  private shouldCaptureRequest(req: Request) {
    const url = (req.originalUrl || req.url || '').toLowerCase();

    if (url.includes('/api/v1/audit-trail')) {
      return false;
    }

    if (req.method.toUpperCase() === 'GET') {
      return false;
    }

    return (
      url.includes('/retirement') ||
      url.includes('/compliance') ||
      url.includes('/csrd') ||
      url.includes('/corsia') ||
      url.includes('/framework-registry')
    );
  }

  private resolveEventType(url: string): AuditEventType {
    const normalized = url.toLowerCase();

    if (normalized.includes('/retirement')) {
      return AuditEventType.RETIREMENT;
    }
    if (normalized.includes('/csrd')) {
      return AuditEventType.CSRD_DISCLOSURE;
    }
    if (normalized.includes('/corsia')) {
      return AuditEventType.CORSIA_SUBMISSION;
    }
    if (normalized.includes('/framework-registry')) {
      return AuditEventType.FRAMEWORK_REGISTRATION;
    }

    return AuditEventType.COMPLIANCE_REPORT;
  }

  private resolveAction(method: string): AuditAction {
    switch (method.toUpperCase()) {
      case 'POST':
        return AuditAction.CREATE;
      case 'PUT':
      case 'PATCH':
        return AuditAction.UPDATE;
      case 'DELETE':
        return AuditAction.DELETE;
      default:
        return AuditAction.VIEW;
    }
  }

  private resolveEntityType(url: string) {
    const segments = url
      .split('?')[0]
      .split('/')
      .filter((segment) => !!segment);

    const apiIndex = segments.findIndex((segment) => segment === 'v1');
    if (apiIndex >= 0 && segments.length > apiIndex + 1) {
      return segments[apiIndex + 1];
    }

    return 'UnknownEntity';
  }

  private resolveEntityId(req: Request) {
    const params = req.params || {};
    const idParam = params.id || params.entityId || params.reportId;
    if (idParam) {
      return String(idParam);
    }

    if (req.body && typeof req.body === 'object') {
      const body = req.body as Record<string, unknown>;
      if (body.id) {
        return String(body.id);
      }
    }

    return 'unknown';
  }
}
