import autocannon from "autocannon";
import { signServiceToken } from "../src/shared/auth/service-token.js";
import { DEFAULT_LOADTEST_JWT_SECRET } from "./server.js";

export type SupportedAgent =
  | "discovery"
  | "pdd-draft"
  | "compliance-report"
  | "alert-triage";

export interface AgentEndpointConfig {
  agent: SupportedAgent;
  path: string;
  issuer: "corporate-platform" | "project-portal";
  payload: Record<string, unknown>;
}

export const AGENT_CONFIGS: Record<SupportedAgent, AgentEndpointConfig> = {
  discovery: {
    agent: "discovery",
    path: "/agents/discovery/run",
    issuer: "corporate-platform",
    payload: {
      requestId: "req-loadtest-discovery",
      requestedBy: "corporate-platform",
      input: {
        budget: 50000,
        sector: "forestry",
        framework: "csrd",
      },
    },
  },
  "pdd-draft": {
    agent: "pdd-draft",
    path: "/agents/pdd-draft/run",
    issuer: "project-portal",
    payload: {
      requestId: "req-loadtest-pdd",
      requestedBy: "project-portal",
      input: {
        activity: "afforestation",
        landArea: 5000,
        targetMethodology: "VM0007",
      },
    },
  },
  "compliance-report": {
    agent: "compliance-report",
    path: "/agents/compliance-report/run",
    issuer: "corporate-platform",
    payload: {
      requestId: "req-loadtest-compliance",
      requestedBy: "corporate-platform",
      input: {
        companyId: "corp-99",
        framework: "csrd",
        year: 2025,
      },
    },
  },
  "alert-triage": {
    agent: "alert-triage",
    path: "/agents/alert-triage/run",
    issuer: "project-portal",
    payload: {
      requestId: "req-loadtest-alert",
      requestedBy: "project-portal",
      input: {
        alertId: "alert-101",
        projectId: "proj-42",
        ndviAnomaly: -0.15,
      },
    },
  },
};

export interface BenchmarkResult {
  agent: SupportedAgent;
  endpoint: string;
  concurrency: number;
  durationSeconds: number;
  totalRequests: number;
  requestsPerSecond: {
    mean: number;
    max: number;
  };
  latencyMs: {
    min: number;
    p50: number;
    p90: number;
    p97_5: number;
    p99: number;
    max: number;
    mean: number;
  };
  throughputBytesPerSec: number;
  success2xx: number;
  non2xx: number;
  errors: number;
  timeouts: number;
}

export interface RunLoadTestOptions {
  baseUrl: string;
  agents?: SupportedAgent[];
  concurrencyLevels?: number[];
  durationSeconds?: number;
  jwtSecret?: string;
  silent?: boolean;
}

export async function runSingleBenchmark(options: {
  baseUrl: string;
  agent: SupportedAgent;
  concurrency: number;
  durationSeconds: number;
  jwtSecret?: string;
}): Promise<BenchmarkResult> {
  const config = AGENT_CONFIGS[options.agent];
  const secret = options.jwtSecret ?? DEFAULT_LOADTEST_JWT_SECRET;
  const token = signServiceToken(config.issuer, secret, {
    expiresInSeconds: 3600,
  });

  const url = `${options.baseUrl.replace(/\/+$/, "")}${config.path}`;

  const result = await autocannon({
    url,
    connections: options.concurrency,
    duration: options.durationSeconds,
    pipelining: 1,
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(config.payload),
  });

  return {
    agent: options.agent,
    endpoint: config.path,
    concurrency: options.concurrency,
    durationSeconds: options.durationSeconds,
    totalRequests: result.requests?.total ?? 0,
    requestsPerSecond: {
      mean: result.requests?.average ?? result.requests?.mean ?? 0,
      max: result.requests?.max ?? 0,
    },
    latencyMs: {
      min: result.latency?.min ?? 0,
      p50: result.latency?.p50 ?? 0,
      p90: result.latency?.p90 ?? 0,
      p97_5: result.latency?.p97_5 ?? 0,
      p99: result.latency?.p99 ?? 0,
      max: result.latency?.max ?? 0,
      mean: result.latency?.average ?? result.latency?.mean ?? 0,
    },
    throughputBytesPerSec: result.throughput?.average ?? 0,
    success2xx: result["2xx"] ?? 0,
    non2xx: result.non2xx ?? 0,
    errors: result.errors ?? 0,
    timeouts: result.timeouts ?? 0,
  };
}

export async function runAgentLoadSuite(
  options: RunLoadTestOptions,
): Promise<BenchmarkResult[]> {
  const agents = options.agents ?? ["discovery"];
  const concurrencyLevels = options.concurrencyLevels ?? [5, 10, 25, 50, 100];
  const durationSeconds = options.durationSeconds ?? 5;
  const results: BenchmarkResult[] = [];

  for (const agent of agents) {
    for (const concurrency of concurrencyLevels) {
      if (!options.silent) {
        // eslint-disable-next-line no-console
        console.log(
          `Running benchmark: agent=${agent}, concurrency=${concurrency}, duration=${durationSeconds}s...`,
        );
      }
      const res = await runSingleBenchmark({
        baseUrl: options.baseUrl,
        agent,
        concurrency,
        durationSeconds,
        jwtSecret: options.jwtSecret,
      });
      results.push(res);
    }
  }

  return results;
}

export function formatResultsTable(results: BenchmarkResult[]): string {
  const headers = [
    "Agent",
    "Concurrency",
    "Req/s (avg)",
    "p50 (ms)",
    "p90 (ms)",
    "p97.5 (ms)",
    "p99 (ms)",
    "Max (ms)",
    "Total Req",
    "Errors",
  ];

  const rows = results.map((r) => [
    r.agent,
    String(r.concurrency),
    (r.requestsPerSecond?.mean ?? 0).toFixed(1),
    (r.latencyMs?.p50 ?? 0).toFixed(2),
    (r.latencyMs?.p90 ?? 0).toFixed(2),
    (r.latencyMs?.p97_5 ?? 0).toFixed(2),
    (r.latencyMs?.p99 ?? 0).toFixed(2),
    (r.latencyMs?.max ?? 0).toFixed(2),
    String(r.totalRequests ?? 0),
    String((r.errors ?? 0) + (r.timeouts ?? 0) + (r.non2xx ?? 0)),
  ]);

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i]!.length)),
  );

  const formatRow = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(colWidths[i]!)).join(" | ");

  const separator = colWidths.map((w) => "-".repeat(w)).join("-|-");

  return [
    formatRow(headers),
    separator,
    ...rows.map((row) => formatRow(row)),
  ].join("\n");
}

export function formatResultsMarkdown(results: BenchmarkResult[]): string {
  const headers = [
    "Agent Endpoint",
    "Concurrency",
    "Avg Req/Sec",
    "p50 Latency",
    "p90 Latency",
    "p97.5 Latency",
    "p99 Latency",
    "Max Latency",
    "Total Req",
    "Failures",
  ];

  const rows = results.map((r) => [
    `\`${r.endpoint}\``,
    String(r.concurrency),
    `${(r.requestsPerSecond?.mean ?? 0).toFixed(1)} req/s`,
    `${(r.latencyMs?.p50 ?? 0).toFixed(2)} ms`,
    `${(r.latencyMs?.p90 ?? 0).toFixed(2)} ms`,
    `${(r.latencyMs?.p97_5 ?? 0).toFixed(2)} ms`,
    `${(r.latencyMs?.p99 ?? 0).toFixed(2)} ms`,
    `${(r.latencyMs?.max ?? 0).toFixed(2)} ms`,
    String(r.totalRequests ?? 0),
    String((r.errors ?? 0) + (r.timeouts ?? 0) + (r.non2xx ?? 0)),
  ]);

  const headerLine = `| ${headers.join(" | ")} |`;
  const sepLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((row) => `| ${row.join(" | ")} |`);

  return [headerLine, sepLine, ...bodyLines].join("\n");
}
