import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

// #704: exercises the real createApp() wiring (the actual express.json()
// limit option and the actual errorHandler), not a hand-rolled replica of
// the middleware stack — the point of this suite is proving what the
// service actually ships with, end to end.
describe("request body size limit (#704)", () => {
  const AGENTS = [
    "discovery",
    "pdd-draft",
    "compliance-report",
    "alert-triage",
  ] as const;

  it.each(AGENTS)(
    "rejects an over-limit body on the %s agent route with 413",
    async (agent) => {
      const oversizedInput = "x".repeat(env.maxRequestBodyBytes + 1024);

      const res = await request(createApp()).post(`/agents/${agent}/run`).send({
        requestId: "req-1",
        requestedBy: "user-1",
        input: oversizedInput,
      });

      expect(res.status).toBe(413);
      expect(res.body).toEqual({ error: "request entity too large" });
    },
  );

  it.each(AGENTS)(
    "does not reject a within-limit body on the %s agent route for size",
    async (agent) => {
      const res = await request(createApp())
        .post(`/agents/${agent}/run`)
        .send({
          requestId: "req-1",
          requestedBy: "user-1",
          input: { small: true },
        });

      // No Authorization header is supplied, so requireInternalAuth
      // rejects it — proving the body was parsed and the request reached
      // downstream middleware rather than being rejected for size (which
      // would be 413, not 401).
      expect(res.status).toBe(401);
    },
  );
});
