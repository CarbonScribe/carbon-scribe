import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { router } from "../src/routes/index.js";

// The flat GET /health route (a static { status: "ok" }) was replaced by
// /health/liveness and /health/readiness (issue #580) — see
// src/health/health.service.test.ts and health.controller.test.ts for the
// readiness probe's all-healthy / dependency-down coverage.
describe("GET /health/liveness", () => {
  it("returns healthy immediately", async () => {
    const app = express();
    app.use(router);

    const res = await request(app).get("/health/liveness");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "healthy", liveness: "up" });
  });
});
