import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { ApiKeyStrategy } from '../strategies/api-key.strategy';
import { API_KEY_PERMISSIONS_METADATA } from '../decorators/api-key-permissions.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyStrategy: ApiKeyStrategy,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(API_KEY_PERMISSIONS_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    let validation;
    try {
      validation = await this.apiKeyStrategy.validate(
        request,
        requiredPermissions,
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        const payload = error.getResponse() as
          | {
              rateLimit?: {
                limit?: number;
                remaining?: number;
                reset?: number;
              };
            }
          | string;

        if (typeof payload === 'object' && payload?.rateLimit) {
          const { limit, remaining, reset } = payload.rateLimit;
          if (limit !== undefined) {
            response.setHeader('X-RateLimit-Limit', String(limit));
          }
          if (remaining !== undefined) {
            response.setHeader('X-RateLimit-Remaining', String(remaining));
          }
          if (reset !== undefined) {
            response.setHeader('X-RateLimit-Reset', String(reset));
          }
        }
      }
      throw error;
    }

    (request as Request & { apiKey?: unknown }).apiKey = validation.apiKey;
    (request as Request & { user?: unknown }).user = validation.apiKey;

    response.setHeader('X-RateLimit-Limit', String(validation.rateLimit.limit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(validation.rateLimit.remaining),
    );
    response.setHeader('X-RateLimit-Reset', String(validation.rateLimit.reset));

    return true;
  }
}
