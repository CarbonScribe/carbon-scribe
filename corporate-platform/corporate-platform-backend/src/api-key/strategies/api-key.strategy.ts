import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '../api-key.service';

@Injectable()
export class ApiKeyStrategy {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async validate(request: Request, requiredPermissions: string[] = []) {
    const rawKey = this.extractApiKey(request);
    if (!rawKey) {
      throw new UnauthorizedException('Missing API key');
    }

    return this.apiKeyService.authenticate(
      rawKey,
      { ipAddress: this.getRequestIp(request) },
      requiredPermissions,
    );
  }

  private extractApiKey(request: Request): string | null {
    const headerKey = request.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (!token) {
      return null;
    }

    const normalizedScheme = scheme.toLowerCase();
    if (normalizedScheme !== 'bearer' && normalizedScheme !== 'apikey') {
      return null;
    }

    return token.trim();
  }

  private getRequestIp(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;

    if (typeof forwardedValue === 'string' && forwardedValue.length > 0) {
      return forwardedValue.split(',')[0]?.trim();
    }

    return request.socket.remoteAddress;
  }
}
