import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { verifyServiceToken } from "../auth/service-token.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * The verified identity of the calling service (its token's `iss`
       * claim) — set only once requireInternalAuth has succeeded. Available
       * to route handlers for e.g. audit logging.
       */
      callingService?: string;
    }
  }
}

const BEARER_PREFIX = "Bearer ";

/**
 * Verifies a per-issuer-signed HS256 service token sent as
 * `Authorization: Bearer <token>` (issue #579) — replaces the old
 * shared-secret `x-internal-token` comparison. On success, attaches the
 * verified caller's identity to `req.callingService` and calls next();
 * otherwise responds 401 without leaking which part of the check failed
 * (missing header, malformed token, unknown issuer, bad signature, and
 * expiry all look identical to the caller).
 */
export function requireInternalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  const identity = verifyServiceToken(token, env.serviceTokenSecrets);
  if (!identity) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  req.callingService = identity.service;
  next();
}
