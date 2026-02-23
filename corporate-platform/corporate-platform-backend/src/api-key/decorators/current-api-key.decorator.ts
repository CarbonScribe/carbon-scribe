import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyAuthContext } from '../interfaces/api-key.interface';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyAuthContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.apiKey;
  },
);
