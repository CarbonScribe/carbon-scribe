import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { helmetOptions } from "./shared/middleware/security-headers.js";
import { migrateAuditLogSchema } from "./shared/audit/audit-log.migrate.js";
import { getPool } from "./shared/audit/db.js";
import { logger } from "./shared/logging/logger.js";

const app = express();

// Baseline HTTP hardening (issue #631), registered before any route so
// every response — the JSON routes, 401s from the auth middleware, and the
// error handler's 500s — carries it. The deliberate, JSON-API-oriented
// policy lives in shared/middleware/security-headers.ts and is shared with
// the header test, so the shipped configuration is the one under test.
app.use(helmet(helmetOptions));

app.use(express.json());
app.use(router);
app.use(errorHandler);

async function main() {
  // Fail fast at boot rather than accepting traffic against a database
  // that doesn't have the audit log table yet.
  await migrateAuditLogSchema(getPool());

  app.listen(env.port, () => {
    logger.info({ port: env.port }, "agent-service listening");
  });
}

main().catch((err) => {
  logger.error({ error: err }, "agent-service failed to start");
  process.exit(1);
});
