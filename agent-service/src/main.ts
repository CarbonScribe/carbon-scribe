import express from "express";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { migrateAuditLogSchema } from "./shared/audit/audit-log.migrate.js";
import { getPool } from "./shared/audit/db.js";

const app = express();

app.use(express.json());
app.use(router);
app.use(errorHandler);

async function main() {
  // Fail fast at boot rather than accepting traffic against a database
  // that doesn't have the audit log table yet.
  await migrateAuditLogSchema(getPool());

  app.listen(env.port, () => {
    console.log(`agent-service listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error("agent-service failed to start:", err);
  process.exit(1);
});
