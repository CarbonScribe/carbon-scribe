import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createRateLimiter, SlidingWindowMemoryStore } from "./rate-limit.js";

describe("rate-limit middleware", () => {
  let store: SlidingWindowMemoryStore;

  beforeEach(async () => {
    store = new SlidingWindowMemoryStore();
  });

  function createTestApp(options = {}) {
    const app = express();
    app.use(express.json());
    // Attach fake callingService if header passed
    app.use((req, _res, next) => {
      const service = req.header("x-mock-service");
      if (service) {
        req.callingService = service;
      }
      next();
    });
    app.post(
      "/run",
      createRateLimiter({ store, max: 2, windowMs: 1000, ...options }),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    return app;
  }

  it("passes requests under the limit and sets rate limit headers", async () => {
    const app = createTestApp();
    const res1 = await request(app)
      .post("/run")
      .set("x-mock-service", "service-a")
      .send({});

    expect(res1.status).toBe(200);
    expect(res1.headers["x-ratelimit-limit"]).toBe("2");
    expect(res1.headers["x-ratelimit-remaining"]).toBe("1");
    expect(res1.headers["x-ratelimit-reset"]).toBeDefined();

    const res2 = await request(app)
      .post("/run")
      .set("x-mock-service", "service-a")
      .send({});

    expect(res2.status).toBe(200);
    expect(res2.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("returns 429 with standard headers when limit is exceeded", async () => {
    const app = createTestApp();
    await request(app).post("/run").set("x-mock-service", "service-a").send({});
    await request(app).post("/run").set("x-mock-service", "service-a").send({});

    const res3 = await request(app)
      .post("/run")
      .set("x-mock-service", "service-a")
      .send({});

    expect(res3.status).toBe(429);
    expect(res3.body.error).toBe("rate_limit_exceeded");
    expect(res3.body.retryAfter).toBeDefined();
    expect(res3.headers["retry-after"]).toBeDefined();
    expect(res3.headers["x-ratelimit-limit"]).toBe("2");
    expect(res3.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("maintains independent rate limit buckets for different callers", async () => {
    const app = createTestApp();
    // service-a uses all its quota
    await request(app).post("/run").set("x-mock-service", "service-a").send({});
    await request(app).post("/run").set("x-mock-service", "service-a").send({});
    const resA = await request(app)
      .post("/run")
      .set("x-mock-service", "service-a")
      .send({});
    expect(resA.status).toBe(429);

    // service-b should be unaffected
    const resB = await request(app)
      .post("/run")
      .set("x-mock-service", "service-b")
      .send({});
    expect(resB.status).toBe(200);
    expect(resB.headers["x-ratelimit-remaining"]).toBe("1");
  });

  it("maintains independent rate limit buckets for different agents", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.callingService = "service-a";
      next();
    });
    app.post(
      "/agents/discovery",
      createRateLimiter({ store, max: 1, agent: "discovery" }),
      (_req, res) => res.json({ agent: "discovery" }),
    );
    app.post(
      "/agents/pdd-draft",
      createRateLimiter({ store, max: 1, agent: "pdd-draft" }),
      (_req, res) => res.json({ agent: "pdd-draft" }),
    );

    // discovery hit
    const res1 = await request(app).post("/agents/discovery").send({});
    expect(res1.status).toBe(200);

    // discovery second hit -> 429
    const res2 = await request(app).post("/agents/discovery").send({});
    expect(res2.status).toBe(429);

    // pdd-draft should still be allowed
    const res3 = await request(app).post("/agents/pdd-draft").send({});
    expect(res3.status).toBe(200);
  });

  it("resets capacity after sliding window expires", async () => {
    const app = createTestApp({ windowMs: 50 });
    await request(app).post("/run").set("x-mock-service", "service-a").send({});
    await request(app).post("/run").set("x-mock-service", "service-a").send({});

    // Exceeded
    const blocked = await request(app)
      .post("/run")
      .set("x-mock-service", "service-a")
      .send({});
    expect(blocked.status).toBe(429);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Now allowed again
    const res = await request(app)
      .post("/run")
      .set("x-mock-service", "service-a")
      .send({});
    expect(res.status).toBe(200);
  });

  it("falls back to IP address when callingService is unauthenticated", async () => {
    const app = express();
    app.use(express.json());
    app.post("/unauth", createRateLimiter({ store, max: 1 }), (_req, res) =>
      res.json({ ok: true }),
    );

    const res1 = await request(app).post("/unauth").send({});
    expect(res1.status).toBe(200);

    const res2 = await request(app).post("/unauth").send({});
    expect(res2.status).toBe(429);
  });
});
