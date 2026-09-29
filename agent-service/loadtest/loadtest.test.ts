import { describe, expect, it } from "vitest";
import {
  ALERT_TRIAGE_FIXTURE_OUTPUT,
  COMPLIANCE_REPORT_FIXTURE_OUTPUT,
  createMockAnthropicClient,
  DISCOVERY_FIXTURE_OUTPUT,
  PDD_FIXTURE_OUTPUT,
} from "./fixtures.js";
import {
  formatResultsMarkdown,
  formatResultsTable,
  runSingleBenchmark,
  type BenchmarkResult,
} from "./runner.js";
import { startLoadTestServer } from "./server.js";

describe("Load Testing Module", () => {
  describe("fixtures", () => {
    it("generates correct fixture responses for all agents", async () => {
      const client = createMockAnthropicClient({ latencyMs: 5 });

      const discoveryRunner = client.beta.messages.toolRunner({
        system: "You are the credit-discovery agent",
      } as unknown as Parameters<typeof client.beta.messages.toolRunner>[0]);
      const discoveryMsg = await discoveryRunner;
      expect(discoveryMsg.stop_reason).toBe("end_turn");
      expect(discoveryMsg.content[0]).toMatchObject({
        type: "text",
        text: JSON.stringify(DISCOVERY_FIXTURE_OUTPUT),
      });

      const pddRunner = client.beta.messages.toolRunner({
        system: "You are the PDD drafting agent",
      } as unknown as Parameters<typeof client.beta.messages.toolRunner>[0]);
      const pddMsg = await pddRunner;
      expect(pddMsg.content[0]).toMatchObject({
        type: "text",
        text: JSON.stringify(PDD_FIXTURE_OUTPUT),
      });

      const complianceRunner = client.beta.messages.toolRunner({
        system: "You are the compliance-report agent",
      } as unknown as Parameters<typeof client.beta.messages.toolRunner>[0]);
      const complianceMsg = await complianceRunner;
      expect(complianceMsg.content[0]).toMatchObject({
        type: "text",
        text: JSON.stringify(COMPLIANCE_REPORT_FIXTURE_OUTPUT),
      });

      const alertRunner = client.beta.messages.toolRunner({
        system: "You are the alert-triage agent",
      } as unknown as Parameters<typeof client.beta.messages.toolRunner>[0]);
      const alertMsg = await alertRunner;
      expect(alertMsg.content[0]).toMatchObject({
        type: "text",
        text: JSON.stringify(ALERT_TRIAGE_FIXTURE_OUTPUT),
      });
    });
  });

  describe("server and runner", () => {
    it("starts test server, runs single benchmark, and stops cleanly", async () => {
      const serverInstance = await startLoadTestServer({
        latencyMs: 0,
      });

      try {
        expect(serverInstance.port).toBeGreaterThan(0);
        expect(serverInstance.baseUrl).toContain("http://localhost:");

        const benchmark = await runSingleBenchmark({
          baseUrl: serverInstance.baseUrl,
          agent: "discovery",
          concurrency: 2,
          durationSeconds: 1,
        });

        expect(benchmark.agent).toBe("discovery");
        expect(benchmark.totalRequests).toBeGreaterThan(0);
        expect(benchmark.success2xx).toBeGreaterThan(0);
        expect(benchmark.errors).toBe(0);
        expect(benchmark.timeouts).toBe(0);
        expect(benchmark.non2xx).toBe(0);
        expect(benchmark.latencyMs.p50).toBeGreaterThanOrEqual(0);
      } finally {
        await serverInstance.close();
      }
    });

    it("formats results table and markdown correctly", () => {
      const mockResult: BenchmarkResult = {
        agent: "discovery",
        endpoint: "/agents/discovery/run",
        concurrency: 10,
        durationSeconds: 5,
        totalRequests: 2500,
        requestsPerSecond: { mean: 500, max: 550 },
        latencyMs: {
          min: 1,
          p50: 10,
          p90: 15,
          p97_5: 18,
          p99: 20,
          max: 25,
          mean: 11,
        },
        throughputBytesPerSec: 102400,
        success2xx: 2500,
        non2xx: 0,
        errors: 0,
        timeouts: 0,
      };

      const table = formatResultsTable([mockResult]);
      expect(table).toContain("discovery");
      expect(table).toContain("500.0");
      expect(table).toContain("10.00");

      const md = formatResultsMarkdown([mockResult]);
      expect(md).toContain("| `/agents/discovery/run` | 10 | 500.0 req/s | 10.00 ms |");
    });
  });
});
