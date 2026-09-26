import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadinessResponse } from "./health.service.js";

const getReadinessMock = vi.fn();
vi.mock("./health.service.js", () => ({
  getReadiness: () => getReadinessMock(),
}));

const { healthRouter } = await import("./health.controller.js");

function buildApp() {
  const app = express();
  app.use("/health", healthRouter);
  return app;
}

function readiness(status: "healthy" | "unhealthy"): ReadinessResponse {
  const detail = { status: "healthy" as const, latencyMs: 5 };
  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: 42,
    checks: {
      anthropic:
        status === "healthy" ? detail : { status: "unhealthy", error: "down" },
      corporatePlatform: detail,
      projectPortal: detail,
    },
  };
}

describe("healthRouter", () => {
  beforeEach(() => {
    getReadinessMock.mockReset();
  });

  it("GET /health/liveness returns 200 without consulting getReadiness", async () => {
    const res = await request(buildApp()).get("/health/liveness");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "healthy",
      service: "agent-service",
      liveness: "up",
    });
    expect(getReadinessMock).not.toHaveBeenCalled();
  });

  it("GET /health/readiness returns 200 with the full body when all dependencies are healthy", async () => {
    const body = readiness("healthy");
    getReadinessMock.mockResolvedValue(body);

    const res = await request(buildApp()).get("/health/readiness");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
  });

  it("GET /health/readiness returns 503 with per-dependency detail when a dependency is down", async () => {
    const body = readiness("unhealthy");
    getReadinessMock.mockResolvedValue(body);

    const res = await request(buildApp()).get("/health/readiness");

    expect(res.status).toBe(503);
    expect(res.body).toEqual(body);
    expect(res.body.checks.anthropic.status).toBe("unhealthy");
  });
});
