import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";

// TODO: replace shared-secret check with whatever auth corporate-platform
// and project-portal already use for service-to-service calls (JWT guard
// pattern exists in corporate-platform/.../guards — reuse it if possible
// instead of inventing a second scheme).
export function requireInternalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.header("x-internal-token");
  if (!env.internalServiceToken || token !== env.internalServiceToken) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
