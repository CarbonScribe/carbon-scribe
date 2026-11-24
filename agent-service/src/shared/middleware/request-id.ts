import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "../context/request-context.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

function isSafeRequestId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(trimmed);
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header("x-request-id");
  const requestId = isSafeRequestId(incoming) ? incoming.trim() : randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  const store = { requestId, abortController: new AbortController() };
  requestContext.run(store, next);
}
