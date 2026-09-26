import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auditRecord = vi.fn().mockResolvedValue(undefined);
vi.mock("../../shared/audit/audit-log.service.js", () => ({
  auditLog: { record: (...args: unknown[]) => auditRecord(...args) },
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

const { runDiscoveryAgent } = await import("./discovery.agent.js");

interface FakeRunnerOptions {
  finalMessage?: { stop_reason: string; content: unknown[] };
  error?: unknown;
  messages?: unknown[];
}

function fakeRunner({ finalMessage, error, messages = [] }: FakeRunnerOptions) {
  return {
    params: { messages },
    then(
      onFulfilled?: ((value: unknown) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) {
      const base =
        error !== undefined
          ? Promise.reject(error)
          : Promise.resolve(finalMessage);
      return base.then(onFulfilled ?? undefined, onRejected ?? undefined);
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

    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: {
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(output) }],
        },
        messages: [{ role: "user", content: "..." }, assistantToolUseMessage],
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

    const result = await runDiscoveryAgent({
      requestId: "req-2",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "Anthropic API error",
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "discovery",
        requestId: "req-2",
        status: "failed",
      }),
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
});
