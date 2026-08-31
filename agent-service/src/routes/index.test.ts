import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRETS = {
  "corporate-platform": "corporate-platform-secret",
  "project-portal": "project-portal-secret",
};

vi.mock("../config/env.js", () => ({
  env: { serviceTokenSecrets: SECRETS, port: 4500, nodeEnv: "test" },
}));

const runDiscoveryAgentMock = vi.fn();
vi.mock("../agents/discovery/discovery.agent.js", () => ({
  runDiscoveryAgent: (...args: unknown[]) => runDiscoveryAgentMock(...args),
}));
const runPddDraftAgentMock = vi.fn();
vi.mock("../agents/pdd-draft/pdd-draft.agent.js", () => ({
  runPddDraftAgent: (...args: unknown[]) => runPddDraftAgentMock(...args),
}));
const runComplianceReportAgentMock = vi.fn();
vi.mock("../agents/compliance-report/compliance-report.agent.js", () => ({
  runComplianceReportAgent: (...args: unknown[]) =>
    runComplianceReportAgentMock(...args),
}));
const runAlertTriageAgentMock = vi.fn();
vi.mock("../agents/alert-triage/alert-triage.agent.js", () => ({
  runAlertTriageAgent: (...args: unknown[]) => runAlertTriageAgentMock(...args),
}));

const { router } = await import("./index.js");
const { signServiceToken } = await import("../shared/auth/service-token.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const routesUnderAuth: Array<{
  path: string;
  mock: ReturnType<typeof vi.fn>;
  agent: string;
}> = [
  {
    path: "/agents/discovery/run",
    mock: runDiscoveryAgentMock,
    agent: "discovery",
  },
  {
    path: "/agents/pdd-draft/run",
    mock: runPddDraftAgentMock,
    agent: "pdd-draft",
  },
  {
    path: "/agents/compliance-report/run",
    mock: runComplianceReportAgentMock,
    agent: "compliance-report",
  },
  {
    path: "/agents/alert-triage/run",
    mock: runAlertTriageAgentMock,
    agent: "alert-triage",
  },
];

describe("all four agent routes enforce requireInternalAuth", () => {
  beforeEach(() => {
    for (const { mock, agent } of routesUnderAuth) {
      mock.mockReset();
      mock.mockResolvedValue({
        agent,
        requestId: "req-1",
        status: "drafted",
        output: {},
        citations: [],
      });
    }
  });

  it("does not require auth for /health/liveness", async () => {
    const res = await request(buildApp()).get("/health/liveness");
    expect(res.status).toBe(200);
  });

  it.each(routesUnderAuth)(
    "rejects $path with 401 when no Authorization header is sent",
    async ({ path, mock }) => {
      const res = await request(buildApp())
        .post(path)
        .send({ requestId: "req-1", requestedBy: "someone", input: {} });

      expect(res.status).toBe(401);
      expect(mock).not.toHaveBeenCalled();
    },
  );

  it.each(routesUnderAuth)(
    "rejects $path with 401 for an expired token",
    async ({ path, mock }) => {
      const token = signServiceToken(
        "corporate-platform",
        SECRETS["corporate-platform"],
        { expiresInSeconds: -10 },
      );

      const res = await request(buildApp())
        .post(path)
        .set("Authorization", `Bearer ${token}`)
        .send({ requestId: "req-1", requestedBy: "someone", input: {} });

      expect(res.status).toBe(401);
      expect(mock).not.toHaveBeenCalled();
    },
  );

  it.each(routesUnderAuth)(
    "accepts $path with a valid token and passes the verified caller through as requestedBy",
    async ({ path, mock }) => {
      const token = signServiceToken(
        "project-portal",
        SECRETS["project-portal"],
      );

      const res = await request(buildApp())
        .post(path)
        .set("Authorization", `Bearer ${token}`)
        .send({
          requestId: "req-1",
          requestedBy: "client-supplied",
          input: {},
        });

      expect(res.status).toBe(200);
      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({ requestedBy: "project-portal" }),
      );
    },
  );
});
