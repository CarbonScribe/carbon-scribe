import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { getRequestContext } from "../context/request-context.js";

export function requestTimeout(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const context = getRequestContext();
  if (!context) {
    next();
    return;
  }

  let settled = false;
  const finish = (): void => {
    settled = true;
  };
  res.on("finish", finish);
  res.on("close", () => {
    if (!res.writableEnded) {
      context.abortController.abort(new Error("client disconnected"));
    }
  });

  const timer = setTimeout(() => {
    if (settled) return;
    context.abortController.abort(new Error("request timed out"));
    if (!res.headersSent) {
      res.status(504).json({
        error: "request_timeout",
        requestId: req.requestId,
      });
    }
  }, env.agentRequestTimeoutMs);

  res.on("finish", () => clearTimeout(timer));
  next();
}
