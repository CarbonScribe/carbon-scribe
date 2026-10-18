import { app } from "./app.js";
import { env } from "./config/env.js";
import { migrateAuditLogSchema } from "./shared/audit/audit-log.migrate.js";
import { closePool, getPool } from "./shared/audit/db.js";
import { outboxDispatcher } from "./shared/outbox/index.js";
import { logger } from "./shared/logging/logger.js";
import { registerGracefulShutdown } from "./shutdown.js";

async function main() {
  // Fail fast at boot rather than accepting traffic against a database
  // that doesn't have the audit log table yet.
  await migrateAuditLogSchema(getPool());
  outboxDispatcher.start();

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "agent-service listening");
  });

  registerGracefulShutdown({
    server,
    closePool,
    stopBackgroundWork: () => outboxDispatcher.stop(),
    timeoutMs: env.shutdownTimeoutMs,
  });
}

main().catch((err) => {
  logger.error({ error: err }, "agent-service failed to start");
  process.exit(1);
});
