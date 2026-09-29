#!/usr/bin/env tsx
import {
  formatResultsMarkdown,
  formatResultsTable,
  runAgentLoadSuite,
  type SupportedAgent,
} from "./runner.js";
import {
  DEFAULT_LOADTEST_JWT_SECRET,
  startLoadTestServer,
} from "./server.js";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
Agent Service Load Testing Tool
===============================
Runs automated concurrency and throughput benchmarks against agent endpoints
with fixture-backed / mocked Anthropic client and in-memory audit database.

Usage:
  npm run loadtest -- [options]
  tsx loadtest/run.ts [options]

Options:
  -c, --concurrency <levels>   Comma-separated concurrency tiers (default: 5,10,25,50,100)
  -d, --duration <seconds>     Benchmark duration per tier in seconds (default: 5)
  -a, --agent <agents>         Agents to test: discovery, pdd-draft, compliance-report,
                               alert-triage, or all (default: discovery)
  -l, --mock-latency <ms>      Simulated LLM response latency in ms (default: 0)
  -u, --target-url <url>       Target existing running server instead of starting mock server
      --json                   Output results in raw JSON format
      --markdown               Output results in markdown table format
  -h, --help                   Show this help message
`);
}

function parseArgs(args: string[]): {
  concurrencyLevels: number[];
  durationSeconds: number;
  agents: SupportedAgent[];
  mockLatencyMs: number;
  targetUrl?: string;
  jsonOutput: boolean;
  markdownOutput: boolean;
  help: boolean;
} {
  const result = {
    concurrencyLevels: [5, 10, 25, 50, 100],
    durationSeconds: 5,
    agents: ["discovery"] as SupportedAgent[],
    mockLatencyMs: 0,
    targetUrl: undefined as string | undefined,
    jsonOutput: false,
    markdownOutput: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--json") {
      result.jsonOutput = true;
    } else if (arg === "--markdown") {
      result.markdownOutput = true;
    } else if (arg === "-c" || arg.startsWith("--concurrency")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[++i];
      if (val) {
        result.concurrencyLevels = val
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0);
      }
    } else if (arg === "-d" || arg.startsWith("--duration")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[++i];
      if (val) {
        result.durationSeconds = Math.max(1, Number(val));
      }
    } else if (arg === "-l" || arg.startsWith("--mock-latency")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[++i];
      if (val) {
        result.mockLatencyMs = Math.max(0, Number(val));
      }
    } else if (arg === "-u" || arg.startsWith("--target-url")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[++i];
      if (val) {
        result.targetUrl = val;
      }
    } else if (arg === "-a" || arg.startsWith("--agent")) {
      const val = arg.includes("=") ? arg.split("=")[1] : args[++i];
      if (val) {
        if (val === "all") {
          result.agents = [
            "discovery",
            "pdd-draft",
            "compliance-report",
            "alert-triage",
          ];
        } else {
          result.agents = val
            .split(",")
            .map((s) => s.trim() as SupportedAgent)
            .filter((a) =>
              [
                "discovery",
                "pdd-draft",
                "compliance-report",
                "alert-triage",
              ].includes(a),
            );
        }
      }
    }
  }

  return result;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  let serverClose: (() => Promise<void>) | null = null;
  let baseUrl = options.targetUrl;

  try {
    if (!baseUrl) {
      if (!options.jsonOutput) {
        // eslint-disable-next-line no-console
        console.log(
          `Starting ephemeral mock-backed agent-service (simulated LLM latency: ${options.mockLatencyMs}ms)...`,
        );
      }
      const instance = await startLoadTestServer({
        latencyMs: options.mockLatencyMs,
        jwtSecret: DEFAULT_LOADTEST_JWT_SECRET,
      });
      baseUrl = instance.baseUrl;
      serverClose = instance.close;
    }

    if (!options.jsonOutput) {
      // eslint-disable-next-line no-console
      console.log(`Target: ${baseUrl}`);
      // eslint-disable-next-line no-console
      console.log(
        `Agents: ${options.agents.join(", ")} | Concurrency tiers: [${options.concurrencyLevels.join(", ")}] | Duration: ${options.durationSeconds}s each\n`,
      );
    }

    const results = await runAgentLoadSuite({
      baseUrl,
      agents: options.agents,
      concurrencyLevels: options.concurrencyLevels,
      durationSeconds: options.durationSeconds,
      jwtSecret: DEFAULT_LOADTEST_JWT_SECRET,
      silent: options.jsonOutput,
    });

    if (options.jsonOutput) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(results, null, 2));
    } else if (options.markdownOutput) {
      // eslint-disable-next-line no-console
      console.log("\n### Benchmark Results (Markdown Table)\n");
      // eslint-disable-next-line no-console
      console.log(formatResultsMarkdown(results));
    } else {
      // eslint-disable-next-line no-console
      console.log("\n=== Load Test Benchmark Summary ===");
      // eslint-disable-next-line no-console
      console.log(formatResultsTable(results));
      // eslint-disable-next-line no-console
      console.log("\nLoad testing completed successfully.");
    }

    const totalErrors = results.reduce(
      (sum, r) => sum + r.errors + r.timeouts + r.non2xx,
      0,
    );
    if (totalErrors > 0) {
      // eslint-disable-next-line no-console
      console.error(`\nWARNING: Encountered ${totalErrors} failed/non-2xx requests during load test.`);
    }
  } finally {
    if (serverClose) {
      await serverClose();
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Load test failed with error:", err);
  process.exit(1);
});
