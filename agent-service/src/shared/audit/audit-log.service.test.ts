import { newDb } from "pg-mem";
import { beforeEach, describe, expect, it } from "vitest";
import { migrateAuditLogSchema } from "./audit-log.migrate.js";
import {
  AuditLogService,
  TOOL_OUTPUT_MAX_BYTES,
  truncateToolOutput,
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
            output: { credits: [{ id: "credit-1", price: 12.5 }] },
          },
        ],
        status,
      };

      await service.record(entry);
      const [found] = await service.findByRequestId(entry.requestId);

      expect(found).toEqual(entry);
    },
  );

  it("round-trips the output field of tool calls correctly", async () => {
    const toolOutput = {
      credits: [
        { id: "c-1", methodology: "REDD+", price: 15 },
        { id: "c-2", methodology: "Gold Standard", price: 22 },
      ],
    };
    const entry: AgentAuditEntry = {
      timestamp: "2026-08-26T12:00:00.000Z",
      agent: "compliance-report",
      requestId: "req-output-roundtrip",
      requestedBy: "user-2",
      toolCalls: [
        {
          name: "get_company_retirement_evidence",
          input: { companyId: "corp-1", framework: "csrd" },
          output: toolOutput,
        },
      ],
      status: "needs-approval",
    };

    await service.record(entry);
    const [found] = await service.findByRequestId(entry.requestId);

    expect(found!.toolCalls).toHaveLength(1);
    expect(found!.toolCalls[0]!.output).toEqual(toolOutput);
  });

  it("stores null as the output for a tool call that produced no result", async () => {
    const entry: AgentAuditEntry = {
      timestamp: "2026-08-26T12:00:00.000Z",
      agent: "alert-triage",
      requestId: "req-null-output",
      requestedBy: "user-3",
      toolCalls: [
        {
          name: "get_monitoring_signals",
          input: { projectId: "p-1" },
          output: null,
        },
      ],
      status: "failed",
    };

    await service.record(entry);
    const [found] = await service.findByRequestId(entry.requestId);

    expect(found!.toolCalls[0]!.output).toBeNull();
  });

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
        {
          name: "get_monitoring_signals",
          input: { projectId: "p-1" },
          output: { ndvi: 0.72 },
        },
      ],
      status: "drafted",
    });

    const results = await service.findByRequestId(requestId);

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe("failed");
    expect(results[1]!.status).toBe("drafted");
    expect(results[1]!.toolCalls[0]!.output).toEqual({ ndvi: 0.72 });
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

describe("truncateToolOutput", () => {
  it("returns the value unchanged when it is within the byte limit", () => {
    const small = { id: "credit-1", price: 15 };
    expect(truncateToolOutput(small)).toEqual(small);
  });

  it("returns a truncation sentinel when the serialised output exceeds TOOL_OUTPUT_MAX_BYTES", () => {
    // Build a string that is guaranteed to exceed the limit.
    const large = { data: "x".repeat(TOOL_OUTPUT_MAX_BYTES + 1) };
    const result = truncateToolOutput(large) as {
      __truncated: boolean;
      byteLength: number;
      preview: string;
    };

    expect(result.__truncated).toBe(true);
    expect(result.byteLength).toBeGreaterThan(TOOL_OUTPUT_MAX_BYTES);
    // Preview must be exactly TOOL_OUTPUT_MAX_BYTES characters.
    expect(result.preview.length).toBe(TOOL_OUTPUT_MAX_BYTES);
  });

  it("handles null output without throwing", () => {
    expect(truncateToolOutput(null)).toBeNull();
  });

  it("handles an array output (e.g. a list of credits) correctly", () => {
    const credits = Array.from({ length: 3 }, (_, i) => ({
      id: `credit-${i}`,
      price: i * 10,
    }));
    expect(truncateToolOutput(credits)).toEqual(credits);
  });
});
