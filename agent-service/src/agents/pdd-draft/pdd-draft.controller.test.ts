import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunResult } from "../../shared/types/agent.types.js";

const runPddDraftAgentMock = vi.fn();
vi.mock("./pdd-draft.agent.js", () => ({
  runPddDraftAgent: (...args: unknown[]) => runPddDraftAgentMock(...args),
}));

const { pddDraftRouter } = await import("./pdd-draft.controller.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/agents/pdd-draft", pddDraftRouter);
  return app;
}

describe("pddDraftRouter POST /run", () => {
  beforeEach(() => {
    runPddDraftAgentMock.mockReset();
  });

  it("returns 200 with the result body for a drafted outcome", async () => {
    const result: AgentRunResult = {
      agent: "pdd-draft",
      requestId: "req-1",
      status: "drafted",
      output: { sections: [], incompleteSections: [] },
      citations: [],
    };
    runPddDraftAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/pdd-draft/run")
      .send({ requestId: "req-1", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
  });

  it("returns 502 with a well-formed body for a failed outcome instead of throwing", async () => {
    const result: AgentRunResult = {
      agent: "pdd-draft",
      requestId: "req-2",
      status: "failed",
      output: { error: "Anthropic API error: internal error" },
    };
    runPddDraftAgentMock.mockResolvedValue(result);

    const res = await request(buildApp())
      .post("/agents/pdd-draft/run")
      .send({ requestId: "req-2", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(502);
    expect(res.body).toEqual(result);
  });

  it("forwards an unexpected thrown error to the next error handler", async () => {
    runPddDraftAgentMock.mockRejectedValue(new Error("unexpected"));

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
      .post("/agents/pdd-draft/run")
      .send({ requestId: "req-3", requestedBy: "user-1", input: {} });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("unexpected");
  });
});
