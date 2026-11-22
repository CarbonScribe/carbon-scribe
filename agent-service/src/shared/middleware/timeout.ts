import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "../../config/env.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      abortController?: AbortController;
      abortSignal?: AbortSignal;
    }
  }
}

export const timeoutStorage = new AsyncLocalStorage<AbortSignal>();

/**
 * Returns the AbortSignal associated with the current asynchronous request context
 * or explicit Request object.
 */
export function getRequestAbortSignal(req?: Request): AbortSignal | undefined {
  if (req?.abortSignal) {
    return req.abortSignal;
  }
  return timeoutStorage.getStore();
}

export interface TimeoutMiddlewareOptions {
  timeoutMs?: number;
}

/**
 * Creates request timeout middleware that:
 * 1. Creates an AbortController per request and attaches it to `req.abortController` and `req.abortSignal`.
 * 2. Runs the downstream pipeline inside an AsyncLocalStorage context with the signal.
 * 3. Aborts the controller and returns 504 if `timeoutMs` elapses before response headers are sent.
 * 4. Aborts the controller if the client disconnects before the response completes (`req.on('close')`).
 */
export function createTimeoutMiddleware(
  optionsOrTimeoutMs?: number | TimeoutMiddlewareOptions,
): RequestHandler {
  const timeoutMs =
    typeof optionsOrTimeoutMs === "number"
      ? optionsOrTimeoutMs
      : (optionsOrTimeoutMs?.timeoutMs ?? env.agentRequestTimeoutMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const controller = new AbortController();
    req.abortController = controller;
    req.abortSignal = controller.signal;

    let timedOut = false;

    // Guard against late writes if timeout occurs while async work is still executing
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body: unknown) {
      if (res.headersSent) {
        return res;
      }
      return originalJson(body);
    };

    res.send = function (body: unknown) {
      if (res.headersSent) {
        return res;
      }
      return originalSend(body);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));

      if (!res.headersSent) {
        res.status(504).json({
          error: "request timeout",
          message: `Request exceeded the configured timeout of ${timeoutMs}ms.`,
        });
      }
    }, timeoutMs);

    // Cancel timer and abort if client disconnects prematurely
    req.on("close", () => {
      clearTimeout(timer);
      if (!res.writableEnded && !timedOut) {
        controller.abort(new Error("Client closed connection"));
      }
    });

    res.on("finish", () => {
      clearTimeout(timer);
    });

    timeoutStorage.run(controller.signal, () => {
      next();
    });
  };
}

export const timeoutMiddleware = createTimeoutMiddleware();
