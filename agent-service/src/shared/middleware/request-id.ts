import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { logger } from "../logging/logger.js";

/**
 * Safe token format for external request IDs: printable ASCII alphanumeric,
 * hyphen, underscore, and dot between 1 and 128 characters.
 */
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{1,128}$/;

export interface RequestContext {
  requestId: string;
  logger: Logger;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Access the active RequestContext (requestId and child logger) for the
 * current request execution chain.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Validates whether an incoming value is a safe, non-empty request ID format.
 */
export function isValidRequestId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  return trimmed.length >= 1 && trimmed.length <= 128 && SAFE_REQUEST_ID_REGEX.test(trimmed);
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: Logger;
    }
  }
}

/**
 * Request ID propagation middleware (#826).
 *
 * 1. Reads incoming `x-request-id` header.
 * 2. If valid safe token (<= 128 chars), preserves it; otherwise generates `crypto.randomUUID()`.
 * 3. Sets `req.requestId` and outgoing `x-request-id` header on the response.
 * 4. Binds a child pino logger with `{ requestId }` and runs downstream handlers in AsyncLocalStorage.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerId = req.headers["x-request-id"];
  const candidate = Array.isArray(headerId) ? headerId[0] : headerId;

  const requestId = isValidRequestId(candidate) ? candidate.trim() : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const reqLogger = logger.child({ requestId });
  req.log = reqLogger;

  requestContextStorage.run({ requestId, logger: reqLogger }, () => {
    next();
  });
}
