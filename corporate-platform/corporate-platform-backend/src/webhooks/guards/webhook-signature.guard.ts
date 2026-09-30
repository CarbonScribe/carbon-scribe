import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { SecurityEvents } from '../../security/constants/security-events.constants';
import { SecurityService } from '../../security/security.service';

type RawRequest = Request & { rawBody?: Buffer };

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly requests = new Map<
    string,
    { started: number; count: number }
  >();

  constructor(private readonly security: SecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RawRequest>();
    const ip = request.ip || 'unknown';
    const now = Date.now();
    const bucket = this.requests.get(ip);
    if (!bucket || now - bucket.started >= 60_000)
      this.requests.set(ip, { started: now, count: 1 });
    else if (++bucket.count > 100) await this.reject(request, 'rate-limit');

    const secret = process.env.WEBHOOK_SIGNING_SECRET;
    const timestamp = request.header('X-Webhook-Timestamp');
    const supplied =
      request.header('X-Webhook-Signature')?.replace(/^sha256=/i, '') ?? '';
    const rawBody = request.rawBody;
    const timestampMs = timestamp ? Number(timestamp) * 1000 : NaN;
    const fresh =
      Number.isFinite(timestampMs) && Math.abs(now - timestampMs) <= 5 * 60_000;
    const payload =
      rawBody && timestamp ? `${timestamp}.${rawBody.toString('utf8')}` : '';
    const expected =
      secret && payload
        ? createHmac('sha256', secret).update(payload).digest('hex')
        : '';
    const valid = Boolean(
      expected &&
      supplied.length === expected.length &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)),
    );
    if (!secret || !rawBody || !valid || !fresh)
      await this.reject(
        request,
        !fresh ? 'stale-timestamp' : 'invalid-signature',
      );
    return true;
  }

  private async reject(request: RawRequest, reason: string): Promise<never> {
    await this.security.logEvent({
      eventType: SecurityEvents.SuspiciousPatternDetected,
      companyId:
        typeof request.body?.companyId === 'string'
          ? request.body.companyId
          : null,
      ipAddress: request.ip,
      method: request.method,
      resource: request.originalUrl,
      details: { reason, webhook: true },
      status: 'failure',
    });
    throw new UnauthorizedException('Invalid webhook signature');
  }
}
