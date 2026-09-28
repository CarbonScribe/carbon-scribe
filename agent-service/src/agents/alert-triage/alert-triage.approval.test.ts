import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunResult } from "../../shared/types/agent.types.js";

const confirmAlertMock = vi.fn();

// Mock only the downstream write. Keeping the rest of the client module real
// means `classifyConfirmAlertError` stays under test too, so a downstream
// failure is classified by the shipping code rather than a stub.
vi.mock("../../clients/project-portal.client.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../clients/project-portal.client.js")
  >("../../clients/project-portal.client.js");
  return {
    ...actual,
    projectPortalClient: {
      ...actual.projectPortalClient,
      confirmAlert: (...args: unknown[]) => confirmAlertMock(...args),
    },
  };
});

const { applyAlertTriageApproval } = await import("./alert-triage.approval.js");
const { mockConfirmAlertResponse } =
  await import("../../clients/project-portal.client.fixtures.js");

const REASONING =
  "NDVI drop corroborated by IoT sensor readings and no weather anomaly.";

function escalateResult(
  overrides: Partial<AgentRunResult> = {},
): AgentRunResult {
  return {
    agent: "alert-triage",
    requestId: "req-1",
    status: "needs-approval",
    output: { verdict: "escalate", reasoning: REASONING },
    citations: [{ source: "iot-sensor-7", reference: "reading-4821" }],
    ...overrides,
  };
}

function readOnlyResult(
  verdict: "suppress" | "needs-more-data",
): AgentRunResult {
  return {
    agent: "alert-triage",
    requestId: `req-${verdict}`,
    status: "drafted",
    output: { verdict, reasoning: "Nothing worth escalating." },
    citations: [],
  };
}

function downstreamError(status?: number) {
  const err = new Error("project-portal rejected the notification") as Error & {
    isAxiosError: boolean;
    response?: { status: number };
  };
  err.isAxiosError = true;
  if (status !== undefined) {
    err.response = { status };
  }
  return err;
}

describe("applyAlertTriageApproval", () => {
  beforeEach(() => {
    confirmAlertMock.mockReset();
  });

  it("pushes a confirmed alert to project-portal when an escalate result is approved", async () => {
    confirmAlertMock.mockResolvedValue(mockConfirmAlertResponse);

    const outcome = await applyAlertTriageApproval(
      { projectId: "proj-1", requestedBy: "user-1", result: escalateResult() },
      "approved",
    );

    expect(outcome).toEqual({
      status: "notified",
      verdict: "escalate",
      notification: mockConfirmAlertResponse,
    });
    expect(confirmAlertMock).toHaveBeenCalledTimes(1);
    const [projectId, payload] = confirmAlertMock.mock.calls[0]!;
    expect(projectId).toBe("proj-1");
    expect(payload).toEqual({
      category: "monitoring.alert",
      subject: "Confirmed alert for project proj-1",
      content: REASONING,
      channels: ["IN_APP"],
      idempotencyKey: "req-1",
      metadata: {
        verdict: "escalate",
        reasoning: REASONING,
        requestId: "req-1",
        requestedBy: "user-1",
        citations: [{ source: "iot-sensor-7", reference: "reading-4821" }],
      },
    });
  });

  it.each(["suppress", "needs-more-data"] as const)(
    "never calls project-portal for a %s verdict, even when passed 'approved'",
    async (verdict) => {
      const outcome = await applyAlertTriageApproval(
        { projectId: "proj-1", result: readOnlyResult(verdict) },
        "approved",
      );

      expect(outcome).toEqual({ status: "not-applicable", verdict });
      expect(confirmAlertMock).not.toHaveBeenCalled();
    },
  );

  it("does not call project-portal when an escalation is rejected", async () => {
    const outcome = await applyAlertTriageApproval(
      { projectId: "proj-1", result: escalateResult() },
      "rejected",
    );

    expect(outcome).toEqual({ status: "rejected", verdict: "escalate" });
    expect(confirmAlertMock).not.toHaveBeenCalled();
  });

  it("surfaces a downstream notification failure distinctly instead of resolving as notified", async () => {
    confirmAlertMock.mockRejectedValue(downstreamError());

    const outcome = await applyAlertTriageApproval(
      { projectId: "proj-1", result: escalateResult() },
      "approved",
    );

    expect(outcome).toEqual({
      status: "notification-failed",
      verdict: "escalate",
      error: "project-portal rejected the notification",
      errorCategory: "connection_error",
      retryable: true,
    });
    expect(confirmAlertMock).toHaveBeenCalledTimes(1);
  });

  it("classifies a 4xx downstream rejection as a non-retryable notification failure", async () => {
    confirmAlertMock.mockRejectedValue(downstreamError(422));

    const outcome = await applyAlertTriageApproval(
      { projectId: "proj-1", result: escalateResult() },
      "approved",
    );

    expect(outcome).toEqual({
      status: "notification-failed",
      verdict: "escalate",
      error: "project-portal rejected the notification",
      errorCategory: "invalid_request",
      retryable: false,
    });
  });

  it("throws rather than guessing when the result has no recognized verdict", async () => {
    await expect(
      applyAlertTriageApproval(
        {
          projectId: "proj-1",
          result: { ...escalateResult(), output: { reasoning: "unparseable" } },
        },
        "approved",
      ),
    ).rejects.toThrow("no recognized verdict");
    expect(confirmAlertMock).not.toHaveBeenCalled();
  });
});
