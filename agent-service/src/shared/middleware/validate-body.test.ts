import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBody } from "./validate-body.js";

describe("validateBody middleware", () => {
  const schema = z.object({
    name: z.string().min(1),
    count: z.number().positive(),
  });

  function createTestApp() {
    const app = express();
    app.use(express.json());
    app.post("/test", validateBody(schema), (req, res) => {
      res.status(200).json({ received: req.body });
    });
    return app;
  }

  it("passes validation and forwards parsed body on valid input", async () => {
    const res = await request(createTestApp())
      .post("/test")
      .send({ name: "valid", count: 10 });

    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ name: "valid", count: 10 });
  });

  it("returns 400 with invalid_request and structured issues when required field is missing", async () => {
    const res = await request(createTestApp())
      .post("/test")
      .send({ count: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues.length).toBeGreaterThan(0);
    expect(res.body.issues[0].path).toContain("name");
  });

  it("returns 400 when field fails validation rules (e.g. non-positive number)", async () => {
    const res = await request(createTestApp())
      .post("/test")
      .send({ name: "valid", count: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
    expect(res.body.issues).toBeInstanceOf(Array);
  });

  it("returns 400 when field has wrong type (e.g. string instead of number)", async () => {
    const res = await request(createTestApp())
      .post("/test")
      .send({ name: "valid", count: "ten" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues[0].path).toContain("count");
  });
});
