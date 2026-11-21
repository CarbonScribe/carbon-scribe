import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

/**
 * Validates req.body against a Zod schema before invoking the route handler.
 * On success, replaces req.body with the parsed result and invokes next().
 * On failure, responds with HTTP 400 and { error: "invalid_request", issues: [...] }.
 */
export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        issues: parsed.error.issues,
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
