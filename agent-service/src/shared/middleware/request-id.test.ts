import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import axios from "axios";
import {
  requestIdMiddleware,
  getRequestContext,
  isValidRequestId,
  requestContextStorage,
} from "./request-id.js";
import { errorHandler } from "./error-handler.js";
import { createApp } from "../../app.js";

describe("Request ID Propagation Middleware (#826)", () => {
  describe("isValidRequestId", () => {
    it("accepts valid UUIDs and safe tokens up to 128 chars", () => {
      expect(isValidRequestId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidRequestId("req-123456")).toBe(true);
      expect(isValidRequestId("abc_DEF-123.456")).toBe(true);
      expect(isValidRequestId("a".repeat(128))).toBe(true);
    });

    it("rejects invalid, dangerous, or empty tokens", () => {
      expect(isValidRequestId("")).toBe(false);
      expect(isValidRequestId("   ")).toBe(false);
      expect(isValidRequestId(null)).toBe(false);
      expect(isValidRequestId(undefined)).toBe(false);
      expect(isValidRequestId("token with spaces")).toBe(false);
      expect(isValidRequestId("token<script>")).toBe(false);
      expect(isValidRequestId("token$injection")).toBe(false);
      expect(isValidRequestId("a".repeat(129))).toBe(false);
    });
  });

  describe("HTTP Request Handling", () => {
    function buildTestApp() {
      const app = express();
      app.use(requestIdMiddleware);
      app.get("/test", (req, res) => {
        const ctx = getRequestContext();
        res.json({
          reqRequestId: req.requestId,
          ctxRequestId: ctx?.requestId,
          hasLogger: Boolean(ctx?.logger),
        });
      });
      app.get("/error", (_req, _res) => {
        throw new Error("test simulated error");
      });
      app.use(errorHandler);
      return app;
    }

    it("preserves a valid incoming x-request-id", async () => {
      const app = buildTestApp();
      const customId = "custom-client-req-999";

      const res = await request(app)
        .get("/test")
        .set("x-request-id", customId);

      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toBe(customId);
      expect(res.body.reqRequestId).toBe(customId);
      expect(res.body.ctxRequestId).toBe(customId);
      expect(res.body.hasLogger).toBe(true);
    });

    it("generates a new UUID when x-request-id is missing", async () => {
      const app = buildTestApp();

      const res = await request(app).get("/test");

      expect(res.status).toBe(200);
      const generated = res.headers["x-request-id"];
      expect(typeof generated).toBe("string");
      expect(isValidRequestId(generated)).toBe(true);
      expect(res.body.reqRequestId).toBe(generated);
      expect(res.body.ctxRequestId).toBe(generated);
    });

    it("replaces an invalid or malformed x-request-id with a generated UUID", async () => {
      const app = buildTestApp();

      const res = await request(app)
        .get("/test")
        .set("x-request-id", "invalid id with spaces!");

      expect(res.status).toBe(200);
      const generated = res.headers["x-request-id"];
      expect(generated).not.toBe("invalid id with spaces!");
      expect(isValidRequestId(generated)).toBe(true);
      expect(res.body.reqRequestId).toBe(generated);
    });

    it("includes requestId in error responses and error logs", async () => {
      const app = buildTestApp();
      const customId = "err-tracing-req-42";

      const res = await request(app)
        .get("/error")
        .set("x-request-id", customId);

      expect(res.status).toBe(500);
      expect(res.headers["x-request-id"]).toBe(customId);
      expect(res.body.error).toBe("test simulated error");
      expect(res.body.requestId).toBe(customId);
    });
  });

  describe("Integration with createApp()", () => {
    it("echoes x-request-id across the entire app stack", async () => {
      const app = createApp();

      const res = await request(app).get("/health/liveness");

      expect(res.status).toBe(200);
      expect(res.headers["x-request-id"]).toBeDefined();
      expect(isValidRequestId(res.headers["x-request-id"])).toBe(true);
    });
  });

  describe("Outbound Header Propagation", () => {
    it("propagates active request ID to axios interceptor", () => {
      const customId = "async-req-context-777";
      let capturedHeader: unknown;

      requestContextStorage.run(
        { requestId: customId, logger: vi.fn() as any },
        () => {
          const config = { headers: {} as Record<string, unknown> };
          const store = getRequestContext();
          if (store?.requestId) {
            config.headers["x-request-id"] = store.requestId;
          }
          capturedHeader = config.headers["x-request-id"];
        },
      );

      expect(capturedHeader).toBe(customId);
    });
  });
});
