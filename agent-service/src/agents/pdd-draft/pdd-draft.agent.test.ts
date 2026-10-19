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

const { runPddDraftAgent } = await import("./pdd-draft.agent.js");

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
// runner is consumed in pdd-draft.agent.ts) — this fake only needs to
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

describe("runPddDraftAgent", () => {
  beforeEach(() => {
    toolRunnerMock.mockReset();
    auditRecord.mockClear();
  });

  it("wires the tool runner with pddDraftTools, DEFAULT_MODEL, and SYSTEM_PROMPT", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                sections: [],
                incompleteSections: [],
                citations: [],
              }),
            },
          ],
        },
      }),
    );

    await runPddDraftAgent({
      requestId: "req-0",
      requestedBy: "user-1",
      input: {},
    });

    expect(toolRunnerMock).toHaveBeenCalledTimes(1);
    const params = toolRunnerMock.mock.calls[0]![0];
    expect(params.model).toBe("claude-opus-5");
    expect(params.system).toContain("PDD (Project Design Document)");
    expect(params.tools.map((t: { name: string }) => t.name)).toContain(
      "match_methodology",
    );
  });

  it("returns a drafted result distinguishing drafted from incomplete sections, and records a drafted audit entry", async () => {
    const output = {
      methodology: "agroforestry",
      sections: [{ name: "Project Description", content: "..." }],
      incompleteSections: [
        {
          name: "Baseline Carbon Stock",
          reason: "No soil sample data provided by the developer.",
        },
      ],
      citations: [{ source: "methodology-registry", reference: "AGRO-01" }],
    };
    const assistantToolUseMessage = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_1",
          name: "match_methodology",
          input: { activityType: "agroforestry", country: "KE" },
        },
      ],
    };

    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(output) }],
        },
        messages: [{ role: "user", content: "..." }, assistantToolUseMessage],
      }),
    );

    const result = await runPddDraftAgent({
      requestId: "req-1",
      requestedBy: "user-1",
      input: { activityType: "agroforestry" },
    });

    expect(result.status).toBe("drafted");
    expect(result.citations).toEqual(output.citations);
    expect(result.output).toEqual({
      methodology: output.methodology,
      sections: output.sections,
      incompleteSections: output.incompleteSections,
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "pdd-draft",
        requestId: "req-1",
        status: "drafted",
        toolCalls: [
          {
            name: "match_methodology",
            input: { activityType: "agroforestry", country: "KE" },
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

    const result = await runPddDraftAgent({
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
        agent: "pdd-draft",
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

    const result = await runPddDraftAgent({
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

    const result = await runPddDraftAgent({
      requestId: "req-4",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "PDD drafting agent tool execution failed",
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

    const result = await runPddDraftAgent({
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

    const result = await runPddDraftAgent({
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
            text: JSON.stringify({
              sections: [],
              incompleteSections: [],
              citations: [],
            }),
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

    const result = await runPddDraftAgent({
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
      expect.objectContaining({ agent: "pdd-draft", status: "failed" }),
    );
  });
});
