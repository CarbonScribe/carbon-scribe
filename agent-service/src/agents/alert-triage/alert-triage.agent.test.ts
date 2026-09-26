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

const { runAlertTriageAgent } = await import("./alert-triage.agent.js");

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

function finalTextMessage(output: unknown) {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
  };
}

describe("runAlertTriageAgent", () => {
  beforeEach(() => {
    toolRunnerMock.mockReset();
    auditRecord.mockClear();
  });

  it("wires the tool runner with alertTriageTools, DEFAULT_MODEL, and SYSTEM_PROMPT", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: finalTextMessage({
          verdict: "suppress",
          reasoning: "Seasonal NDVI dip, no corroborating sensor drop.",
          citations: [],
        }),
      }),
    );

    await runAlertTriageAgent({
      requestId: "req-0",
      requestedBy: "user-1",
      input: {},
    });

    expect(toolRunnerMock).toHaveBeenCalledTimes(1);
    const params = toolRunnerMock.mock.calls[0]![0];
    expect(params.model).toBe("claude-opus-5");
    expect(params.system).toContain("alert-triage agent");
    expect(params.tools.map((t: { name: string }) => t.name)).toContain(
      "get_monitoring_signals",
    );
  });

  it("returns status drafted for a suppress verdict and records a drafted audit entry", async () => {
    const output = {
      verdict: "suppress",
      reasoning: "Seasonal NDVI dip, no corroborating sensor drop.",
      citations: [
        { source: "ndvi-series", reference: "2026-08-01..2026-08-20" },
      ],
    };
    const assistantToolUseMessage = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "call_1",
          name: "get_monitoring_signals",
          input: { projectId: "proj-1", sinceIso: "2026-08-01T00:00:00Z" },
        },
      ],
    };

    toolRunnerMock.mockReturnValue(
      fakeRunner({
        finalMessage: finalTextMessage(output),
        messages: [{ role: "user", content: "..." }, assistantToolUseMessage],
      }),
    );

    const result = await runAlertTriageAgent({
      requestId: "req-1",
      requestedBy: "user-1",
      input: { projectId: "proj-1" },
    });

    expect(result.status).toBe("drafted");
    expect(result.citations).toEqual(output.citations);
    expect(result.output).toEqual({
      verdict: "suppress",
      reasoning: output.reasoning,
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "alert-triage",
        requestId: "req-1",
        status: "drafted",
        toolCalls: [
          {
            name: "get_monitoring_signals",
            input: { projectId: "proj-1", sinceIso: "2026-08-01T00:00:00Z" },
          },
        ],
      }),
    );
  });

  it("returns status needs-approval for an escalate verdict and records a needs-approval audit entry", async () => {
    const output = {
      verdict: "escalate",
      reasoning:
        "NDVI drop corroborated by IoT sensor readings and no weather anomaly.",
      citations: [{ source: "iot-sensor-7", reference: "reading-4821" }],
    };

    toolRunnerMock.mockReturnValue(
      fakeRunner({ finalMessage: finalTextMessage(output) }),
    );

    const result = await runAlertTriageAgent({
      requestId: "req-2",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("needs-approval");
    expect(result.output).toEqual({
      verdict: "escalate",
      reasoning: output.reasoning,
    });
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs-approval" }),
    );
  });

  it("returns status drafted for a needs-more-data verdict", async () => {
    const output = {
      verdict: "needs-more-data",
      reasoning:
        "IoT sensor for this plot is offline; cannot corroborate the NDVI drop.",
      citations: [],
    };

    toolRunnerMock.mockReturnValue(
      fakeRunner({ finalMessage: finalTextMessage(output) }),
    );

    const result = await runAlertTriageAgent({
      requestId: "req-6",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("drafted");
    expect((result.output as { verdict: string }).verdict).toBe(
      "needs-more-data",
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

    const result = await runAlertTriageAgent({
      requestId: "req-3",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "Anthropic API error",
    );
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "alert-triage",
        requestId: "req-3",
        status: "failed",
      }),
    );
  });

  it("returns a failed result distinguishing a non-API failure", async () => {
    toolRunnerMock.mockReturnValue(
      fakeRunner({ error: new Error("boom while iterating") }),
    );

    const result = await runAlertTriageAgent({
      requestId: "req-4",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain(
      "Alert-triage agent tool execution failed",
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

    const result = await runAlertTriageAgent({
      requestId: "req-5",
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

    const result = await runAlertTriageAgent({
      requestId: "req-7",
      requestedBy: "user-1",
      input: {},
    });

    expect(result.status).toBe("failed");
    expect((result.output as { error: string }).error).toContain("declined");
  });
});
