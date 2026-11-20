import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { helmetOptions } from "./shared/middleware/security-headers.js";

export function createApp(): express.Express {
  const app = express();

  // Baseline HTTP hardening (issue #631), registered before any route so
  // every response — the JSON routes, 401s from the auth middleware, and the
  // error handler's 500s — carries it.
  app.use(helmet(helmetOptions));

  // Explicit, documented limit rather than Express's implicit 100kb default
  // (#704) — see shared/middleware/body-limit.ts.
  app.use(express.json({ limit: env.maxRequestBodyBytes }));
  app.use(router);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
