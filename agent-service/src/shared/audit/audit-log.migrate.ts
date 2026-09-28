import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { Queryable } from "./audit-log.service.js";

// Path from this file to the migrations directory stays the same whether
// this runs as src/shared/audit/audit-log.migrate.ts under tsx (dev) or
// dist/shared/audit/audit-log.migrate.js under node (prod) — dist mirrors
// src's nesting depth, so climbing three levels always lands on the
// package root either way.
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../migrations",
);

/**
 * Applies agent-service's own migrations (currently just
 * 001_create_agent_audit_log.sql) against `pool`. Every statement in that
 * file is idempotent (CREATE TABLE/INDEX IF NOT EXISTS), so this is safe to
 * call on every process start rather than requiring a separate
 * migration-runner step.
 */
export async function migrateAuditLogSchema(pool: Queryable): Promise<void> {
  for (const migration of [
    "001_create_agent_audit_log.sql",
    "002_create_agent_approvals.sql",
    "003_extend_approval_outbox.sql",
  ]) {
    const sql = readFileSync(join(MIGRATIONS_DIR, migration), "utf8");
    await pool.query(sql);
  }
}
