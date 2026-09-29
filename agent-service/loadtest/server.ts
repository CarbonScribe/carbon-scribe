import type { Server } from "http";
import { newDb } from "pg-mem";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { setAnthropicClient } from "../src/llm/client.js";
import { migrateAuditLogSchema } from "../src/shared/audit/audit-log.migrate.js";
import type { Queryable } from "../src/shared/audit/audit-log.service.js";
import { setPool } from "../src/shared/audit/db.js";
import { createMockAnthropicClient } from "./fixtures.js";

export interface LoadTestServerOptions {
  port?: number;
  latencyMs?: number;
  jwtSecret?: string;
}

export interface LoadTestServerInstance {
  server: Server;
  port: number;
  baseUrl: string;
  pool: Queryable;
  close: () => Promise<void>;
}

export const DEFAULT_LOADTEST_JWT_SECRET = "loadtest-shared-secret-key-123456789";

export async function startLoadTestServer(
  options: LoadTestServerOptions = {},
): Promise<LoadTestServerInstance> {
  const latencyMs = options.latencyMs ?? 0;
  const jwtSecret = options.jwtSecret ?? DEFAULT_LOADTEST_JWT_SECRET;

  // Set up in-memory Postgres database
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as Queryable;
  await migrateAuditLogSchema(pool);
  setPool(pool);

  // Set up mock Anthropic client with configurable simulated latency
  const mockAnthropic = createMockAnthropicClient({ latencyMs });
  setAnthropicClient(mockAnthropic);

  // Ensure serviceTokenSecrets has working secret
  if (!env.serviceTokenSecrets["corporate-platform"]) {
    env.serviceTokenSecrets["corporate-platform"] = jwtSecret;
  }
  if (!env.serviceTokenSecrets["project-portal"]) {
    env.serviceTokenSecrets["project-portal"] = jwtSecret;
  }

  const app = createApp();

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(options.port ?? 0, () => {
      resolve(s);
    });
  });

  const address = server.address();
  const actualPort =
    address && typeof address === "object" ? address.port : (options.port ?? 4500);
  const baseUrl = `http://localhost:${actualPort}`;

  return {
    server,
    port: actualPort,
    baseUrl,
    pool,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
