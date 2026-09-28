import express from "express";
import helmet from "helmet";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { router } from "../../routes/index.js";
import { helmetOptions } from "./security-headers.js";

/**
 * Mirrors the middleware stack main.ts builds: Helmet first, then the
 * router. The point of the test is that the *same* options object the
 * service ships with produces hardening headers on real responses — and
 * that enabling them doesn't disturb the health probes.
 */
function buildApp() {
  const app = express();
  app.use(helmet(helmetOptions));
  app.use(express.json());
  app.use(router);
  return app;
}

describe("helmet security headers", () => {
  it("sets the baseline hardening headers on /health/liveness", async () => {
    const res = await request(buildApp()).get("/health/liveness");

    // The probe itself is unchanged by the middleware (issue #631 AC3).
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "healthy", liveness: "up" });

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    expect(res.headers["x-download-options"]).toBe("noopen");
    expect(res.headers["x-permitted-cross-domain-policies"]).toBe("none");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
  });

  it("keeps /health/readiness reachable with the headers applied", async () => {
    // No dependency mocking here: the readiness probe is exercised for its
    // HTTP path only, so the assertions stay on status + headers rather than
    // the per-dependency body.
    const res = await request(buildApp()).get("/health/readiness");

    expect([200, 503]).toContain(res.status);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("removes the X-Powered-By fingerprint header", async () => {
    const res = await request(buildApp()).get("/health/liveness");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("omits CSP for a document-less JSON API", async () => {
    const res = await request(buildApp()).get("/health/liveness");
    const headers = res.headers;

    expect(headers["content-security-policy"]).toBeUndefined();
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
    expect(headers["cross-origin-embedder-policy"]).toBeUndefined();
  });

  it("applies the headers to non-2xx responses too", async () => {
    const res = await request(buildApp())
      .post("/agents/discovery/run")
      .send({ requestId: "req-1", requestedBy: "someone", input: {} });

    expect(res.status).toBe(401);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });
});
