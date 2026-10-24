import type { NextFunction, Request, Response } from "express";
import { logger } from "../logging/logger.js";

// body-parser throws this (via the `http-errors` package) when a request
// body exceeds express.json()'s configured `limit` (#704) — its `type` is
// always exactly this string, so checking it is more precise than
// trusting an arbitrary thrown error's `status`/`statusCode` to mean the
// same thing a different library might reuse that field for.
function isPayloadTooLarge(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: unknown }).type === "entity.too.large"
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error(
    {
      error: err,
      method: req.method,
      path: req.path,
      requestId: req.headers["x-request-id"],
    },
    "Request error",
  );

  if (isPayloadTooLarge(err)) {
    res.status(413).json({ error: "request entity too large" });
    return;
  }

  const message = err instanceof Error ? err.message : "internal error";
  res.status(500).json({ error: message });
}
