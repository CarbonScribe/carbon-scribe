import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response } from "express";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { newDb } from "pg-mem";
import { createTimeoutMiddleware, getRequestAbortSignal } from "./timeout.js";
import { errorHandler } from "./error-handler.js";
import { classifyAnthropicError } from "../../llm/errors.js";
import {
  AuditLogService,
  type AgentAuditEntry,
  type Queryable,
} from "../audit/audit-log.service.js";
import { migrateAuditLogSchema } from "../audit/audit-log.migrate.js";

describe("Request Timeout Middleware (#827)", () => {
  describe("HTTP request timeout handling", () => {
    it("allows fast handlers to complete normally (200 OK)", async () => {
      const app = express();
      app.use(createTimeoutMiddleware(500));
      app.get("/fast", (_req, res) => {
        res.json({ status: "ok" });
      });
      app.use(errorHandler);

      const response = await request(app).get("/fast");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });

    it("returns 504 when a handler exceeds the configured timeout", async () => {
      const app = express();
      app.use(createTimeoutMiddleware(50));
      app.get("/slow", async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (!res.headersSent) {
          res.json({ status: "completed-late" });
        }
      });
      app.use(errorHandler);

      const response = await request(app).get("/slow");
      expect(response.status).toBe(504);
      expect(response.body.error).toBe("request timeout");
      expect(response.body.message).toContain("50ms");
    });

    it("aborts req.abortSignal when the request times out", async () => {
      const app = express();
      app.use(createTimeoutMiddleware(50));
      let signalAborted = false;

      app.get("/check-signal", async (req, _res) => {
        req.abortSignal?.addEventListener("abort", () => {
          signalAborted = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      app.use(errorHandler);

      const response = await request(app).get("/check-signal");
      expect(response.status).toBe(504);
      expect(signalAborted).toBe(true);
    });

    it("makes AbortSignal accessible via getRequestAbortSignal inside AsyncLocalStorage", async () => {
      const app = express();
      app.use(createTimeoutMiddleware(500));
      let contextSignalAvailable = false;

      app.get("/check-context", (req, res) => {
        const signalFromContext = getRequestAbortSignal();
        contextSignalAvailable = signalFromContext === req.abortSignal;
        res.json({ ok: contextSignalAvailable });
      });
      app.use(errorHandler);

      const response = await request(app).get("/check-context");
      expect(response.status).toBe(200);
      expect(contextSignalAvailable).toBe(true);
    });

    it("aborts req.abortSignal when the client disconnects prematurely", () => {
      const middleware = createTimeoutMiddleware(5000);
      const reqListeners: Record<string, () => void> = {};
      const req = {
        on: vi.fn((event: string, handler: () => void) => {
          reqListeners[event] = handler;
          return req;
        }),
      } as unknown as Request;

      const res = {
        on: vi.fn(),
        json: vi.fn(),
        send: vi.fn(),
        writableEnded: false,
        headersSent: false,
      } as unknown as Response;
      const next = vi.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.abortSignal).toBeDefined();
      expect(req.abortSignal?.aborted).toBe(false);

      // Trigger client disconnect
      expect(reqListeners.close).toBeDefined();
      reqListeners.close();
      expect(req.abortSignal?.aborted).toBe(true);
    });
  });

  describe("Error classification for timeouts and cancellations", () => {
    it("classifies APIUserAbortError as timeout", () => {
      const err = new Anthropic.APIUserAbortError();
      const classified = classifyAnthropicError(err, "discovery");
      expect(classified.category).toBe("timeout");
      expect(classified.retryable).toBe(true);
    });

    it("classifies standard AbortError and TimeoutError as timeout", () => {
      const abortErr = new Error("This operation was aborted");
      abortErr.name = "AbortError";
      const classifiedAbort = classifyAnthropicError(abortErr, "discovery");
      expect(classifiedAbort.category).toBe("timeout");
      expect(classifiedAbort.retryable).toBe(true);

      const timeoutErr = new Error("The operation timed out");
      timeoutErr.name = "TimeoutError";
      const classifiedTimeout = classifyAnthropicError(timeoutErr, "discovery");
      expect(classifiedTimeout.category).toBe("timeout");
      expect(classifiedTimeout.retryable).toBe(true);
    });

    it("classifies axios ECONNABORTED and ERR_CANCELED as timeout", () => {
      const axiosAbort = new axios.AxiosError(
        "timeout of 10000ms exceeded",
        "ECONNABORTED",
      );
      const classified = classifyAnthropicError(axiosAbort, "discovery");
      expect(classified.category).toBe("timeout");
      expect(classified.retryable).toBe(true);
    });
  });

  describe("Audit log recording with timeout category", () => {
    it("persists failed audit entries with errorCategory: timeout", async () => {
      const db = newDb();
      const { Pool } = db.adapters.createPg();
      const pool = new Pool() as unknown as Queryable;
      await migrateAuditLogSchema(pool);
      const auditService = new AuditLogService(pool);

      const entry: AgentAuditEntry = {
        timestamp: new Date().toISOString(),
        agent: "discovery",
        requestId: "req-timeout-test",
        requestedBy: "test-caller",
        toolCalls: [],
        status: "failed",
        errorCategory: "timeout",
      };

      await auditService.record(entry);
      const records = await auditService.findByRequestId("req-timeout-test");
      expect(records).toHaveLength(1);
      expect(records[0]?.status).toBe("failed");
      expect(records[0]?.errorCategory).toBe("timeout");
    });
  });
});
