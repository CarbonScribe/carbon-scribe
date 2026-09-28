import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decide: vi.fn(),
  listPending: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  env: { approvalReviewerServices: ["project-portal"] },
}));
vi.mock("./approval.service.js", () => ({
  ApprovalConflictError: class ApprovalConflictError extends Error {},
  ApprovalNotFoundError: class ApprovalNotFoundError extends Error {},
  approvalService: {
    decide: mocks.decide,
    listPending: mocks.listPending,
  },
}));

const { approvalsRouter } = await import("./approvals.controller.js");

function buildApp(callingService: string | undefined) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.callingService = callingService;
    next();
  });
  app.use("/approvals", approvalsRouter);
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : "error" });
    },
  );
  return app;
}

describe("approvalsRouter decision trust labeling", () => {
  beforeEach(() => {
    mocks.decide.mockReset();
    mocks.listPending.mockReset();
    mocks.decide.mockResolvedValue({ requestId: "req-1", status: "approved" });
  });

  it.each(["approve", "reject"] as const)(
    "passes service-asserted reviewer ID with verified caller for %s",
    async (decision) => {
      const response = await request(buildApp("project-portal"))
        .post(`/approvals/req-1/${decision}`)
        .send({ reviewerId: "human-42", callingService: "forged-service" });

      expect(response.status).toBe(200);
      expect(mocks.decide).toHaveBeenCalledWith(
        "req-1",
        decision === "approve" ? "approved" : "rejected",
        "human-42",
        "project-portal",
      );
    },
  );

  it("rejects an authenticated but non-allowlisted caller", async () => {
    const response = await request(buildApp("corporate-platform"))
      .post("/approvals/req-1/approve")
      .send({ reviewerId: "human-42" });

    expect(response.status).toBe(403);
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("requires a reviewer ID assertion from the allowlisted service", async () => {
    const response = await request(buildApp("project-portal"))
      .post("/approvals/req-1/reject")
      .send({});

    expect(response.status).toBe(400);
    expect(mocks.decide).not.toHaveBeenCalled();
  });
});
