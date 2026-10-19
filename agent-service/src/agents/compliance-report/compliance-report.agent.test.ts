import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auditRecord = vi.fn().mockResolvedValue(undefined);
vi.mock("../../shared/audit/audit-log.service.js", () => ({
  auditLog: { record: (...args: unknown[]) => auditRecord(...args) },
  // Pass output through unchanged in tests — truncation is covered by
  // audit-log.service.test.ts, not by agent-level tests.
  truncateToolOutput: (output: unknown) => output,
}));

const toolRunnerMock = vi.fn();
vi.mock("../../llm/client.js", () => ({
  anthropic: {
    beta: {
      messages: {
        toolRunner: (...args: unknown[]) => toolRunnerMock(...args),
      },
    },
  },
  DEFAULT_MODEL: "claude-opus-5",
}));

// A small, deterministic token budget so a budget-exceeded test doesn't
// need unrealistically large usage figures to trip it (#701). Iteration
// count is left at the real default since no test here relies on
// exhausting it.
vi.mock("../../config/env.js", () => ({
  env: { agentMaxIterations: 8, agentMaxTokensPerRun: 1000 },
}));

const { runComplianceReportAgent } =
  await import("./compliance-report.agent.js");

interface FakeTurn {
  stop_reason: string;
  content: unknown[];
  usage?: { input_tokens: number; output_tokens: number };
}

interface FakeRunnerOptions {
  /** A single-turn run (the common case in these tests). */
  finalMessage?: FakeTurn;
  /** A multi-turn run, for exercising cumulative-usage tracking across
   *  turns. Ignored if finalMessage is set. */
  turns?: FakeTurn[];
  error?: unknown;
  messages?: unknown[];
}

// The real BetaToolRunner is both directly awaitable and async-iterable
// (runWithTokenBudget drives it via `for await`, matching how the real
// runner is consumed in compliance-report.agent.ts) — this fake only needs
// to support the latter, since that's the only way the agent now consumes
// it.
function fakeRunner({
  finalMessage,
  turns,
  error,
  messages = [],
}: FakeRunnerOptions) {
  const yieldedTurns = turns ?? (finalMessage ? [finalMessage] : []);
  return {
    params: { messages },
    async *[Symbol.asyncIterator]() {
      for (const turn of yieldedTurns) {
        yield turn;
      }
      if (error !== undefined) {
        throw error;
      }
    },
  };
}

function finalTextMessage(output: unknown) {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
  };
}

describe("runComplianceReportAgent", () => {
  beforeEach(() => {
    toolRunnerMock.mockReset();
    auditRecord.mockClear();
  });

  it("wires the tool runner with complianceReportTools, DEFAULT_MODEL, and SYSTEM_PROMPT", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: finalTextMessage({
          sections: [],
          gaps: [],
          citations: [],
        }),
      }),
    );

    await runComplianceReportAgent({
      requestId: "req-0",
      requestedBy: "user-1",
      input: {},
    });

    expect(toolRunnerMock).toHaveBeenCalledTimes(1);
    const params = toolRunnerMock.mock.calls[0]![0];
    expect(params.model).toBe("claude-opus-5");
    expect(params.system).toContain("compliance-report drafting agent");
    expect(params.tools.map((t: { name: string }) => t.name)).toContain(
      "get_company_retirement_evidence",
    );
  });

  it.each([
    {
      label: "a complete draft with no gaps",
      output: {
        framework: "csrd",
        sections: [{ name: "Scope 3 Emissions", content: "..." }],
        gaps: [],
        citations: [{ source: "retirement-ledger", reference: "R-001" }],
      },
    },
    {
      label: "a draft with flagged gaps and no framework match",
      output: {
        sections: [],
        gaps: [{ description: "No retirement records found for period." }],
        citations: [],
      },
    },
  ])(
    "always returns status needs-approval on success, never drafted ($label)",
    async ({ output }) => {
      toolRunnerMock.mockReturnValue(
        fakeRunner({ finalMessage: finalTextMessage(output) }),
      );

      const result = await runComplianceReportAgent({
        requestId: "req-guardrail",
        requestedBy: "user-1",
        input: {},
      });

      expect(result.status).toBe("needs-approval");
      expect(result.status).not.toBe("drafted");
    },
  );

  it("records a needs-approval audit entry (never drafted) and maps citations on success", async () => {
    const output = {
      framework: "cbam",
      sections: [{ name: "Embedded Emissions", content: "..." }],
      gaps: [{ description: "Missing supplier attestation for Q3." }],
      citations: [{ source: "portfolio", reference: "P-42" }],
    };
    const assistantToolUseMessage = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_1",
          name: "get_company_retirement_evidence",
          input: {
            companyId: "co-1",
            framework: "cbam",
            periodStart: "2026-01-01",
            periodEnd: "2026-06-30",
          },
        },
      ],
    };

    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: finalTextMessage(output),
        messages: [{ role: "user", content: "..." }, assistantToolUseMessage],
      }),
    );

    const result = await runComplianceReportAgent({
      requestId: "req-1",
      requestedBy: "user-1",
      input: { companyId: "co-1" },
    });

    expect(result.status).toBe("needs-approval");
    expect(result.citations).toEqual(output.citations);
    expect(result.output).toEqual({
      framework: output.framework,
      sections: output.sections,
      gaps: output.gaps,
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "compliance-report",
        requestId: "req-1",
        status: "needs-approval",
        toolCalls: [
          {
            name: "get_company_retirement_evidence",
            input: {
              companyId: "co-1",
              framework: "cbam",
              periodStart: "2026-01-01",
              periodEnd: "2026-06-30",
            },
            output: null,
          },
        ],
      }),
    );
  });

  it("returns a failed result distinguishing an Anthropic API failure, and records a failed audit entry", async () => {
    const apiError = new Anthropic.APIError(
      500,
      { message: "internal error" },
      "internal error",
      undefined,
    );
    toolRunnerMock.mockReturnValue(fakeRunner({ error: apiError }));

    const result = await runComplianceReportAgent({
      requestId: "req-2",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain("API error");
    expect(result.errorCategory).toBe("connection_error");
    expect(result.retryable).toBe(true);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "compliance-report",
        requestId: "req-2",
        status: "failed",
      }),
    );
  });

  it("classifies rate limit errors as retryable", async () => {
    const rateLimitError = new Anthropic.RateLimitError(
      429,
      { message: "rate limit exceeded" },
      "rate limit exceeded",
      new Headers(),
    );
    toolRunnerMock.mockReturnValue(fakeRunner({ error: rateLimitError }));

    const result = await runComplianceReportAgent({
      requestId: "req-3",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect(result.errorCategory).toBe("rate_limited");
    expect(result.retryable).toBe(true);
    expect((result.output as { error: string }).error).toContain(
      "Rate limit exceeded",
    );
  });

  it("returns a failed result distinguishing a non-API failure", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({ error: new Error("boom while iterating") }),
    );

    const result = await runComplianceReportAgent({
      requestId: "req-4",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "Compliance-report agent tool execution failed",
    );
  });

  it("returns a failed result when the final output cannot be parsed against the schema", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "not json" }],
        },
      }),
    );

    const result = await runComplianceReportAgent({
      requestId: "req-3",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "could not be parsed",
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("returns a failed result on a refusal-terminated turn", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: { stop_reason: "refusal", content: [] },
      }),
    );

    const result = await runComplianceReportAgent({
      requestId: "req-5",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain("declined");
  });

  it("aborts a run that exceeds its token budget, returning failed before consuming further turns", async () => {
    let turnsProduced = 0;
    const turns: FakeTurn[] = [
      {
        stop_reason: "tool_use",
        content: [],
        usage: { input_tokens: 600, output_tokens: 200 },
      },
      {
        stop_reason: "tool_use",
        content: [],
        usage: { input_tokens: 150, output_tokens: 100 },
      },
      // Would otherwise complete the run successfully; must never be reached.
      {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: JSON.stringify({ sections: [], gaps: [], citations: [] }),
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
      },
    ];

    toolRunnerMock.mockReturnValue({
      params: { messages: [] },
      async *[Symbol.asyncIterator]() {
        for (const turn of turns) {
          turnsProduced++;
          yield turn;
        }
      },
    });

    const result = await runComplianceReportAgent({
      requestId: "req-budget",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "token budget",
    );
    expect(turnsProduced).toBe(2);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ agent: "compliance-report", status: "failed" }),
    );
  });
});
