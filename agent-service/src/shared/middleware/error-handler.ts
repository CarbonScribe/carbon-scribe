import type { NextFunction, Request, Response } from "express";
import { logger } from "../logging/logger.js";

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
  const message = err instanceof Error ? err.message : "internal error";
  res.status(500).json({ error: message });
}
