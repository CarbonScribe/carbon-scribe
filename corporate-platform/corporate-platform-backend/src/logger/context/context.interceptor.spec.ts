import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { ContextInterceptor } from './context.interceptor';
import { RequestContext } from './request-context';
import { LoggerService } from '../logger.service';

describe('ContextInterceptor (#736)', () => {
  let interceptor: ContextInterceptor;

  function buildContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  function buildHandler(): CallHandler {
    return { handle: () => of('ok') };
  }

  beforeEach(() => {
    interceptor = new ContextInterceptor({} as unknown as LoggerService);
  });

  it("reuses RequestLoggerMiddleware's requestId/traceId instead of deriving its own", (done) => {
    const req: any = {
      headers: {},
      path: '/api/v1/portfolio/summary',
      requestId: 'mw-request-id',
      traceId: 'mw-trace-id',
    };

    interceptor.intercept(buildContext(req), buildHandler()).subscribe({
      next: () => {
        expect(RequestContext.get()?.requestId).toBe('mw-request-id');
        expect(RequestContext.get()?.traceId).toBe('mw-trace-id');
      },
      complete: () => done(),
    });
  });

  it('falls back to deriving IDs from headers when the middleware has not run', (done) => {
    const req: any = {
      headers: { 'x-request-id': 'header-request-id' },
      path: '/api/v1/portfolio/summary',
    };

    interceptor.intercept(buildContext(req), buildHandler()).subscribe({
      next: () => {
        expect(RequestContext.get()?.requestId).toBe('header-request-id');
      },
      complete: () => done(),
    });
  });
});
