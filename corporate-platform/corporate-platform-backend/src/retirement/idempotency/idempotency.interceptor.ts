import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IdempotencyKeyService } from './idempotency-key.service';
import { IdempotencyKeyValidator } from './idempotency-key.validator';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyKeyService: IdempotencyKeyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey =
      request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()];

    // If no idempotency key, proceed without idempotency
    if (!idempotencyKey) {
      return next.handle();
    }

    // Validate the idempotency key
    const validation = IdempotencyKeyValidator.validate(idempotencyKey);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Store the normalized key in request for later use
    const normalizedKey = IdempotencyKeyValidator.normalize(idempotencyKey);
    request.idempotencyKey = normalizedKey;

    return next.handle().pipe(
      map((response) => {
        // Add idempotency headers to response
        const res = context.switchToHttp().getResponse();
        res.setHeader(IDEMPOTENCY_KEY_HEADER, normalizedKey);

        if (response?.isReplay) {
          res.setHeader('Idempotency-Result', 'replay');
        } else {
          res.setHeader('Idempotency-Result', 'success');
        }

        return response;
      }),
    );
  }
}
