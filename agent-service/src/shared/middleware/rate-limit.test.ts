import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createRateLimitMiddleware, type RateLimitStore } from "./rate-limit.js";

class TestStore implements RateLimitStore {
  private counts = new Map<string, number>();
  take(key: string, limit: number, windowMs: number, now: number) {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt: now + windowMs };
    }
    return { allowed: true, remaining: limit - count, resetAt: now + windowMs };
  }
}

function appFor(store: RateLimitStore) {
  const app = express();
  app.use((req, _res, next) => {
    req.callingService = req.header("x-caller") ?? undefined;
    next();
  });
  app.use("/agents/discovery", createRateLimitMiddleware(store), (_req, res) => res.sendStatus(200));
  return app;
}

describe("per-caller rate limiting", () => {
  it("passes under the limit and rejects over it with standard headers", async () => {
    const app = appFor(new TestStore());
    const first = await request(app).post("/agents/discovery/run").set("x-caller", "a");
    expect(first.status).toBe(200);

    for (let i = 0; i < 59; i++) {
      await request(app).post("/agents/discovery/run").set("x-caller", "a");
    }
    const blocked = await request(app).post("/agents/discovery/run").set("x-caller", "a");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.headers["x-ratelimit-limit"]).toBeDefined();
  });

  it("keeps caller buckets independent", async () => {
    const app = appFor(new TestStore());
    await request(app).post("/agents/discovery/run").set("x-caller", "a");
    const other = await request(app).post("/agents/discovery/run").set("x-caller", "b");
    expect(other.status).toBe(200);
  });
});
