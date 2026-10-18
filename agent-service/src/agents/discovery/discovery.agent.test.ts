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

// A small, deterministic token budget so budget-exceeded tests don't need
// unrealistically large usage figures to trip it (#701). Iteration count is
// left at the real default since no test here relies on exhausting it.
vi.mock("../../config/env.js", () => ({
  env: { agentMaxIterations: 8, agentMaxTokensPerRun: 1000 },
}));

const { runDiscoveryAgent } = await import("./discovery.agent.js");
const { logger } = await import("../../shared/logging/logger.js");

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
// runner is consumed in discovery.agent.ts) — this fake only needs to
// support the latter, since that's the only way the agent now consumes it.
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

describe("runDiscoveryAgent", () => {
  beforeEach(() => {
    toolRunnerMock.mockReset();
    auditRecord.mockClear();
  });

  it("wires the tool runner with discoveryTools, DEFAULT_MODEL, and SYSTEM_PROMPT", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: JSON.stringify({ recommendations: [], citations: [] }),
            },
          ],
        },
      }),
    );

    await runDiscoveryAgent({
      requestId: "req-0",
      requestedBy: "user-1",
      input: {},
    });

    expect(toolRunnerMock).toHaveBeenCalledTimes(1);
    const params = toolRunnerMock.mock.calls[0]![0];
    expect(params.model).toBe("claude-opus-5");
    expect(params.system).toContain("credit-discovery agent");
    expect(params.tools.map((t: { name: string }) => t.name)).toContain(
      "search_marketplace_credits",
    );
  });

  it("returns a drafted result and records a drafted audit entry on success", async () => {
    const output = {
      recommendations: [
        { creditId: "credit-1", justification: "Matches sector and budget." },
      ],
      citations: [{ source: "marketplace", reference: "credit-1" }],
    };
    const assistantToolUseMessage = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_1",
          name: "search_marketplace_credits",
          input: { methodology: "REDD+" },
        },
      ],
    };
    const toolResultMessage = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "call_1",
          content: [{ id: "credit-1", methodology: "REDD+", price: 15 }],
        },
      ],
    };

    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(output) }],
        },
        messages: [
          { role: "user", content: "..." },
          assistantToolUseMessage,
          toolResultMessage,
        ],
      }),
    );

    const result = await runDiscoveryAgent({
      requestId: "req-1",
      requestedBy: "user-1",
      input: { budget: 1000 },
    });

    expect(result.status).toBe("drafted");
    expect(result.citations).toEqual(output.citations);
    expect(result.output).toEqual({
      recommendations: output.recommendations,
      notes: undefined,
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "discovery",
        requestId: "req-1",
        status: "drafted",
        toolCalls: [
          {
            name: "search_marketplace_credits",
            input: { methodology: "REDD+" },
            output: [{ id: "credit-1", methodology: "REDD+", price: 15 }],
          },
        ],
      }),
    );
  });

  it("records output: null for a tool call whose result was not captured (e.g. runner aborted before tool_result)", async () => {
    const output = {
      recommendations: [],
      citations: [],
    };
    const assistantToolUseMessage = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_no_result",
          name: "search_marketplace_credits",
          input: { methodology: "VCS" },
        },
      ],
    };
    // No matching tool_result user message.
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(output) }],
        },
        messages: [{ role: "user", content: "..." }, assistantToolUseMessage],
      }),
    );

    await runDiscoveryAgent({
      requestId: "req-no-result",
      requestedBy: "user-1",
      input: {},
    });

    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCalls: [
          expect.objectContaining({
            name: "search_marketplace_credits",
            output: null,
          }),
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

    const result = await runDiscoveryAgent({
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
        agent: "discovery",
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

    const result = await runDiscoveryAgent({
      requestId: "req-6",
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

    const result = await runDiscoveryAgent({
      requestId: "req-4",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "Discovery agent tool execution failed",
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

    const result = await runDiscoveryAgent({
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

    const result = await runDiscoveryAgent({
      requestId: "req-5",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain("declined");
  });

  it("aborts a run that exceeds its token budget, returning failed with a descriptive error, before consuming further turns", async () => {
    let turnsProduced = 0;
    const turns: FakeTurn[] = [
      // 600 + 200 = 800, still within the 1000-token mocked budget.
      {
        stop_reason: "tool_use",
        content: [],
        usage: { input_tokens: 600, output_tokens: 200 },
      },
      // +150 + 100 = 1050, crosses the budget — the run must stop here.
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
            text: JSON.stringify({ recommendations: [], citations: [] }),
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

    const result = await runDiscoveryAgent({
      requestId: "req-budget",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "token budget",
    );
    expect((result.output as { error: string }).error).toContain("1050");
    // Only the two turns needed to cross the budget were ever produced —
    // the third (successful) turn was never reached, so the run stopped
    // rather than continuing to consume tokens.
    expect(turnsProduced).toBe(2);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ agent: "discovery", status: "failed" }),
    );
  });

  it("logs cumulative token usage alongside the audit entry for both a successful and a budget-aborted run", async () => {
    const infoSpy = vi.spyOn(logger, "info");

    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: JSON.stringify({ recommendations: [], citations: [] }),
            },
          ],
          usage: { input_tokens: 40, output_tokens: 10 },
        },
      }),
    );
    await runDiscoveryAgent({
      requestId: "req-usage-ok",
      requestedBy: "user-1",
      input: {},
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "discovery",
        requestId: "req-usage-ok",
        status: "drafted",
        cumulativeTokens: 50,
      }),
      "agent run token usage",
    );

    infoSpy.mockClear();
    toolRunnerMock.mockReturnValue({
      params: { messages: [] },
      async *[Symbol.asyncIterator]() {
        yield {
          stop_reason: "tool_use",
          content: [],
          usage: { input_tokens: 900, output_tokens: 200 },
        };
      },
    });
    await runDiscoveryAgent({
      requestId: "req-usage-aborted",
      requestedBy: "user-1",
      input: {},
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "discovery",
        requestId: "req-usage-aborted",
        status: "failed",
        cumulativeTokens: 1100,
      }),
      "agent run token usage",
    );
  });
});
