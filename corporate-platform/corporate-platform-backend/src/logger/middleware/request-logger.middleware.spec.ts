import { RequestLoggerMiddleware } from './request-logger.middleware';
import { LoggerService } from '../logger.service';

describe('RequestLoggerMiddleware (#736)', () => {
  let middleware: RequestLoggerMiddleware;
  let logger: { info: jest.Mock };

  function buildReqRes(headers: Record<string, string> = {}) {
    const listeners: Record<string, () => void> = {};
    const req: any = {
      headers,
      method: 'GET',
      path: '/api/v1/portfolio/summary',
      url: '/api/v1/portfolio/summary',
      connection: {},
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      get() {
        return undefined;
      },
      json(body: any) {
        return body;
      },
      on(event: string, cb: () => void) {
        listeners[event] = cb;
      },
    };
    return { req, res, finish: () => listeners['finish']?.() };
  }

  beforeEach(() => {
    logger = { info: jest.fn() };
    middleware = new RequestLoggerMiddleware(
      logger as unknown as LoggerService,
    );
  });

  it('echoes a client-supplied x-request-id back on the response', () => {
    const { req, res, finish } = buildReqRes({
      'x-request-id': 'client-supplied-id',
    });

    middleware.use(req, res, () => {});
    finish();

    expect(res.headers['x-request-id']).toBe('client-supplied-id');
    expect(logger.info).toHaveBeenCalledWith(
      'HTTP request completed',
      expect.objectContaining({ requestId: 'client-supplied-id' }),
    );
  });

  it('sets x-request-id and x-trace-id response headers matching the server-side log entry when no IDs are supplied', () => {
    const { req, res, finish } = buildReqRes();

    middleware.use(req, res, () => {});
    finish();

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-trace-id']).toBeDefined();

    const loggedMetadata = logger.info.mock.calls[0][1];
    expect(loggedMetadata.requestId).toBe(res.headers['x-request-id']);
  });

  it('derives the trace ID from a W3C traceparent header', () => {
    const { req, res } = buildReqRes({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });

    middleware.use(req, res, () => {});

    expect(res.headers['x-trace-id']).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('exposes requestId/traceId on the request object for downstream code', () => {
    const { req, res } = buildReqRes({ 'x-request-id': 'r1' });

    middleware.use(req, res, () => {});

    expect(req.requestId).toBe('r1');
    expect(req.traceId).toBeDefined();
  });
});
