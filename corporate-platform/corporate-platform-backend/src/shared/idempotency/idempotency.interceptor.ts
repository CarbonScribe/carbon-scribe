import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable, from, of, throwError } from 'rxjs';
import { concatMap, switchMap, catchError } from 'rxjs/operators';
import { Response } from 'express';
import { IdempotencyService } from './idempotency.service';
import { computeRequestHash, isValidUuid } from './idempotency.utils';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse<Response>();

    const rawKey = request.headers[IDEMPOTENCY_KEY_HEADER] as
      | string
      | undefined;

    // Check if key is required
    if (!rawKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          'Idempotency-Key header is required in production',
        );
      }
      return next.handle();
    }

    const idempotencyKey = rawKey.trim();
    if (!isValidUuid(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID');
    }

    const companyId = request.user?.companyId || request.companyId;
    if (!companyId) {
      throw new BadRequestException(
        'Company context is required for idempotent requests',
      );
    }

    const route =
      request.route?.path || request.baseUrl + request.path || request.url;
    const requestHash = computeRequestHash(request.body);

    const check = await this.idempotencyService.acquire(
      idempotencyKey,
      companyId,
      route,
      requestHash,
    );

    if (check.isReplay) {
      const statusCode = check.responseStatus || 200;
      response.status(statusCode);
      response.setHeader('Idempotency-Key', idempotencyKey);
      response.setHeader('Idempotency-Replay', 'true');
      return of(check.responseBody);
    }

    return next.handle().pipe(
      concatMap(async (data) => {
        const statusCode = response.statusCode || 201;
        await this.idempotencyService.complete(
          idempotencyKey,
          companyId,
          statusCode,
          data,
        );
        response.setHeader('Idempotency-Key', idempotencyKey);
        response.setHeader('Idempotency-Replay', 'false');
        return data;
      }),
      catchError((err) =>
        from(this.idempotencyService.fail(idempotencyKey, companyId)).pipe(
          switchMap(() => throwError(() => err)),
        ),
      ),
    );
  }
}
