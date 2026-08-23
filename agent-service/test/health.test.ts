import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { router } from "../src/routes/index.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = express();
    app.use(router);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
