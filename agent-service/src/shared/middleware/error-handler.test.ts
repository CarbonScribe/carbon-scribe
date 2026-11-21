import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./error-handler.js";

function buildApp(thrown: unknown) {
  const app = express();
  app.get("/boom", (_req, _res, next) => {
    next(thrown);
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  // #704: this is the exact shape body-parser's http-errors-based
  // PayloadTooLargeError takes — a plain Error with a `type` property,
  // rather than a dedicated exported class this handler could `instanceof`
  // check against.
  it("maps a body-parser entity.too.large error to 413 with a clear message", async () => {
    const err = Object.assign(new Error("request entity too large"), {
      type: "entity.too.large",
      length: 2_000_000,
      limit: 1_048_576,
      status: 413,
      statusCode: 413,
    });

    const res = await request(buildApp(err)).get("/boom");

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "request entity too large" });
  });

  it("falls back to 500 for an error that merely happens to carry a 413 status without the entity.too.large type", async () => {
    const err = Object.assign(new Error("some other 413"), { status: 413 });

    const res = await request(buildApp(err)).get("/boom");

    expect(res.status).toBe(500);
  });

  it("maps an ordinary Error to a generic 500", async () => {
    const res = await request(buildApp(new Error("db unreachable"))).get(
      "/boom",
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "db unreachable" });
  });

  it("maps a thrown non-Error value to a generic 500 with a fixed message", async () => {
    const res = await request(buildApp("not an error")).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal error" });
  });
});
