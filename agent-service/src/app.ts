import express from "express";
import helmet from "helmet";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { helmetOptions } from "./shared/middleware/security-headers.js";

export function createApp(): express.Express {
  const app = express();

  // Baseline HTTP hardening (issue #631), registered before any route so
  // every response — the JSON routes, 401s from the auth middleware, and the
  // error handler's 500s — carries it.
  app.use(helmet(helmetOptions));

  app.use(express.json());
  app.use(router);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
