import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { openapiRouter } from "./openapi.controller.js";
import { openApiSpec } from "./openapi.document.js";

function buildApp() {
  const app = express();
  app.use(openapiRouter);
  return app;
}

describe("openapi.controller", () => {
  it("GET /openapi.json returns 200 with application/json and valid spec", async () => {
    const res = await request(buildApp()).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toEqual(openApiSpec);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toBe("agent-service API");
  });

  it("GET /openapi.yaml returns 200 with text/yaml", async () => {
    const res = await request(buildApp()).get("/openapi.yaml");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/yaml");
    expect(res.text).toContain("openapi: 3.0.3");
    expect(res.text).toContain("title: agent-service API");
    expect(res.text).toContain("/agents/discovery/run:");
    expect(res.text).toContain("/health/liveness:");
  });
});
