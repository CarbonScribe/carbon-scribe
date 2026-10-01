import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openApiSpec } from "./openapi.document.js";
import { toYaml } from "./yaml.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

describe("OpenAPI 3.0.3 specification contracts", () => {
  it("conforms to OpenAPI 3.0.3 basic structure", () => {
    expect(openApiSpec.openapi).toBe("3.0.3");
    expect(openApiSpec.info.title).toBe("agent-service API");
    expect(openApiSpec.info.version).toBeDefined();
    expect(openApiSpec.paths).toBeDefined();
    expect(openApiSpec.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("covers all mounted routes in routes/index.ts", () => {
    const paths = Object.keys(openApiSpec.paths);

    // Health probes
    expect(paths).toContain("/health/liveness");
    expect(paths).toContain("/health/readiness");

    // Four agents
    expect(paths).toContain("/agents/discovery/run");
    expect(paths).toContain("/agents/pdd-draft/run");
    expect(paths).toContain("/agents/compliance-report/run");
    expect(paths).toContain("/agents/alert-triage/run");

    // Approval routes
    expect(paths).toContain("/approvals");
    expect(paths).toContain("/approvals/{requestId}/approve");
    expect(paths).toContain("/approvals/{requestId}/reject");

    // OpenAPI routes
    expect(paths).toContain("/openapi.json");
    expect(paths).toContain("/openapi.yaml");
  });

  it("documents bearerAuth security on all authenticated routes and omits it on public routes", () => {
    const paths = openApiSpec.paths;

    // Public routes (no security)
    expect(
      (paths["/health/liveness"].get as { security?: unknown }).security,
    ).toBeUndefined();
    expect(
      (paths["/health/readiness"].get as { security?: unknown }).security,
    ).toBeUndefined();
    expect(
      (paths["/openapi.json"].get as { security?: unknown }).security,
    ).toBeUndefined();
    expect(
      (paths["/openapi.yaml"].get as { security?: unknown }).security,
    ).toBeUndefined();

    // Authenticated agent routes
    expect(paths["/agents/discovery/run"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(paths["/agents/pdd-draft/run"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(paths["/agents/compliance-report/run"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(paths["/agents/alert-triage/run"].post.security).toEqual([
      { bearerAuth: [] },
    ]);

    // Authenticated approvals routes
    expect(paths["/approvals"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/approvals/{requestId}/approve"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(paths["/approvals/{requestId}/reject"].post.security).toEqual([
      { bearerAuth: [] },
    ]);
  });

  it("documents 200, 401, and 502 responses for all agent run routes", () => {
    const agentPaths = [
      "/agents/discovery/run",
      "/agents/pdd-draft/run",
      "/agents/compliance-report/run",
      "/agents/alert-triage/run",
    ] as const;

    for (const path of agentPaths) {
      const responses = openApiSpec.paths[path].post.responses;
      expect(responses["200"]).toBeDefined();
      expect(responses["401"]).toBeDefined();
      expect(responses["502"]).toBeDefined();
    }
  });

  it("ensures checked-in openapi.json and openapi.yaml are in sync with openApiSpec", () => {
    const jsonPath = path.join(projectRoot, "openapi.json");
    const yamlPath = path.join(projectRoot, "openapi.yaml");

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(yamlPath)).toBe(true);

    const onDiskJson = fs.readFileSync(jsonPath, "utf-8");
    const onDiskYaml = fs.readFileSync(yamlPath, "utf-8");

    const expectedJson = JSON.stringify(openApiSpec, null, 2) + "\n";
    const expectedYaml = toYaml(openApiSpec);

    expect(onDiskJson).toBe(expectedJson);
    expect(onDiskYaml).toBe(expectedYaml);
  });
});
