import { newDb } from "pg-mem";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateAuditLogSchema } from "./audit-log.migrate.js";
import {
  AuditLogService,
  type AgentAuditEntry,
  type Queryable,
} from "./audit-log.service.js";

// Real SQL against pg-mem's in-memory Postgres-compatible engine, not a
// mocked query() — this exercises the actual migration file and the
// actual INSERT/SELECT statements, so a broken column name or type
// mismatch would fail these tests the same way it would against a real
// database, without needing a live Postgres for `vitest run`.
function createTestService(): { service: AuditLogService; pool: Queryable } {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as Queryable;
  return { service: new AuditLogService(pool), pool };
}

describe("AuditLogService", () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const created = createTestService();
    service = created.service;
    await migrateAuditLogSchema(created.pool);
  });

  it.each<AgentAuditEntry["status"]>(["drafted", "needs-approval", "failed"])(
    "writes an entry with status %s and reads it back with the same content",
    async (status) => {
      const entry: AgentAuditEntry = {
        timestamp: "2026-08-26T12:00:00.000Z",
        agent: "discovery",
        requestId: `req-${status}`,
        requestedBy: "user-1",
        toolCalls: [
          {
            name: "search_marketplace_credits",
            input: { methodology: "REDD+" },
          },
        ],
        status,
      };

      await service.record(entry);
      const [found] = await service.findByRequestId(entry.requestId);

      expect(found).toEqual(entry);
    },
  );

  it("returns entries for a requestId ordered oldest first", async () => {
    const requestId = "req-multi";
    await service.record({
      timestamp: "2026-08-26T12:00:00.000Z",
      agent: "alert-triage",
      requestId,
      requestedBy: "user-1",
      toolCalls: [],
      status: "failed",
    });
    await service.record({
      timestamp: "2026-08-26T12:05:00.000Z",
      agent: "alert-triage",
      requestId,
      requestedBy: "user-1",
      toolCalls: [
        { name: "get_monitoring_signals", input: { projectId: "p-1" } },
      ],
      status: "drafted",
    });

    const results = await service.findByRequestId(requestId);

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("failed");
    expect(results[1]!.status).toBe("drafted");
  });

  it("returns an empty array for a requestId that was never recorded", async () => {
    const results = await service.findByRequestId("never-recorded");
    expect(results).toEqual([]);
  });

  it("does not swallow a write failure — record() rejects instead of resolving silently", async () => {
    const brokenPool: Queryable = {
      query: () => Promise.reject(new Error("connection refused")),
    };
    const brokenService = new AuditLogService(brokenPool);

    await expect(
      brokenService.record({
        timestamp: "2026-08-26T12:00:00.000Z",
        agent: "discovery",
        requestId: "req-outage",
        requestedBy: "user-1",
        toolCalls: [],
        status: "drafted",
      }),
    ).rejects.toThrow("connection refused");
  });
});
