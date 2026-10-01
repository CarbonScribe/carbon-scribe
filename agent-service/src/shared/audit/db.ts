import { Pool } from "pg";
import { env } from "../../config/env.js";
import type { Queryable } from "./audit-log.service.js";

// Single shared connection pool for agent-service's own Postgres store
// (currently just agent_audit_log — see audit-log.service.ts). Created
// lazily so importing this module never opens a connection by itself;
// tests inject their own Pool (backed by pg-mem) instead of touching this.
let pool: Queryable | undefined;

export function getPool(): Queryable {
  if (!pool) {
    pool = new Pool({ connectionString: env.agentAuditDatabaseUrl });
  }
  return pool;
}

export function setPool(customPool?: Queryable): void {
  pool = customPool;
}
