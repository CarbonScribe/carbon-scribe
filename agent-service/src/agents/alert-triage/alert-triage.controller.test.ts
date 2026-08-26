import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunResult } from "../../shared/types/agent.types.js";

const runAlertTriageAgentMock = vi.fn();
vi.mock("./alert-triage.agent.js", () => ({
  runAlertTriageAgent: (...args: unknown[]) => runAlertTriageAgentMock(...args),
}));

const { alertTriageRouter } = await import("./alert-triage.controller.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/agents/alert-triage", alertTriageRouter);
  return app;
}

describe("alertTriageRouter POST /run", () => {
  beforeEach(() => {
    runAlertTriageAgentMock.mockReset();
  });

  it("returns 200 with the result body for a drafted outcome", async () => {
    const result: AgentRunResult = {
      agent: "alert-triage",
      requestId: "req-1",
      status: "drafted",
      output: { verdict: "suppress", reasoning: "Seasonal variation." },
      citations: [],
    };
    runAlertTriageAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/alert-triage/run")
      .send({ requestId: "req-1", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
  });

  it("returns 200 with the result body for a needs-approval (escalate) outcome", async () => {
    const result: AgentRunResult = {
      agent: "alert-triage",
      requestId: "req-2",
      status: "needs-approval",
      output: { verdict: "escalate", reasoning: "Corroborated by IoT sensor." },
      citations: [],
    };
    runAlertTriageAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/alert-triage/run")
      .send({ requestId: "req-2", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("needs-approval");
  });

  it("returns 502 with a well-formed body for a failed outcome instead of throwing", async () => {
    const result: AgentRunResult = {
      agent: "alert-triage",
      requestId: "req-3",
      status: "failed",
      output: { error: "Anthropic API error: internal error" },
    };
    runAlertTriageAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/alert-triage/run")
      .send({ requestId: "req-3", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(502);
    expect(res.body).toEqual(result);
  });

  it("forwards an unexpected thrown error to the next error handler", async () => {
    runAlertTriageAgentMock.mockRejectedValue(new Error("unexpected"));

    const app = buildApp();
    app.use(
      (
        err: unknown,
        _req: express.Request,
        res: express.Response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _next: express.NextFunction,
      ) => {
        res.status(500).json({
          error: err instanceof Error ? err.message : "internal error",
        });
      },
    );

    const res = await request(app)
      .post("/agents/alert-triage/run")
      .send({ requestId: "req-4", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("unexpected");
  });
});
