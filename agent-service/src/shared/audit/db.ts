import { Pool } from "pg";
import { env } from "../../config/env.js";

// Single shared connection pool for agent-service's own Postgres store
// (currently just agent_audit_log — see audit-log.service.ts). Created
// lazily so importing this module never opens a connection by itself;
// tests inject their own Pool (backed by pg-mem) instead of touching this.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: env.agentAuditDatabaseUrl });
  }
  return pool;
}
