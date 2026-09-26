import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunResult } from "../../shared/types/agent.types.js";

const runComplianceReportAgentMock = vi.fn();
vi.mock("./compliance-report.agent.js", () => ({
  runComplianceReportAgent: (...args: unknown[]) =>
    runComplianceReportAgentMock(...args),
}));

const { complianceReportRouter } =
  await import("./compliance-report.controller.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/agents/compliance-report", complianceReportRouter);
  return app;
}

describe("complianceReportRouter POST /run", () => {
  beforeEach(() => {
    runComplianceReportAgentMock.mockReset();
  });

  it("returns 200 with the result body for a needs-approval outcome", async () => {
    const result: AgentRunResult = {
      agent: "compliance-report",
      requestId: "req-1",
      status: "needs-approval",
      output: { sections: [], gaps: [] },
      citations: [],
    };
    runComplianceReportAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/compliance-report/run")
      .send({ requestId: "req-1", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    expect(res.body.status).toBe("needs-approval");
  });

  it("returns 502 with a well-formed body for a failed outcome instead of throwing", async () => {
    const result: AgentRunResult = {
      agent: "compliance-report",
      requestId: "req-2",
      status: "failed",
      output: { error: "Anthropic API error: internal error" },
    };
    runComplianceReportAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/compliance-report/run")
      .send({ requestId: "req-2", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(502);
    expect(res.body).toEqual(result);
  });

  it("forwards an unexpected thrown error to the next error handler", async () => {
    runComplianceReportAgentMock.mockRejectedValue(new Error("unexpected"));

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
      .post("/agents/compliance-report/run")
      .send({ requestId: "req-3", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("unexpected");
  });
});
