import { Pool } from "pg";
import { env } from "../../config/env.js";
import type { Queryable } from "./audit-log.service.js";

// Single shared connection pool for agent-service's own Postgres store
// (currently just agent_audit_log — see audit-log.service.ts). Created
// lazily so importing this module never opens a connection by itself;
// tests inject their own Pool (backed by pg-mem) instead of touching this.
let pool: Queryable | undefined;

// Tracked separately from `pool` so closePool() only ever calls the real
// pg.Pool's `.end()` — a test-injected Queryable (via setPool) may not be a
// real Pool at all, and tests manage that stand-in's lifecycle themselves.
let realPool: Pool | undefined;

export function getPool(): Queryable {
  if (!pool) {
    const created = new Pool({ connectionString: env.agentAuditDatabaseUrl });
    pool = created;
    realPool = created;
  }
  return pool;
}

export function setPool(customPool?: Queryable): void {
  pool = customPool;
  realPool = undefined;
}

/**
 * Ends the real Postgres pool, if one has been created. Called on graceful
 * shutdown (#700), after the HTTP server has stopped accepting new
 * connections and in-flight requests (and the audit-log writes they may
 * trigger) have finished — never concurrently with a write in flight.
 *
 * A no-op when no real pool exists yet, or when a test has substituted its
 * own Queryable via setPool().
 */
export async function closePool(): Promise<void> {
  if (!realPool) {
    return;
  }
  const toClose = realPool;
  pool = undefined;
  realPool = undefined;
  await toClose.end();
}
