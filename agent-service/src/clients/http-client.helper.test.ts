import type { AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isRetryableError,
  errorMessage,
  summarizeResponseShape,
  withRetry,
  requestWithLogging,
  logSchemaValidationError,
  type CallContext,
} from "./http-client.helper.js";
import { logger } from "../shared/logging/logger.js";

function makeAxiosError({
  status,
  hasResponse = true,
}: {
  status?: number;
  hasResponse?: boolean;
}) {
  const err = new Error("axios failure") as Error & {
    isAxiosError: boolean;
    response?: { status: number };
  };
  err.isAxiosError = true;
  if (hasResponse) {
    err.response = { status: status ?? 500 };
  }
  return err;
}

describe("http-client.helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isRetryableError", () => {
    it("returns false for non-axios errors", () => {
      expect(isRetryableError(new Error("standard error"))).toBe(false);
      expect(isRetryableError("just a string")).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });

    it("returns true for axios errors without a response (network failure / timeout)", () => {
      expect(isRetryableError(makeAxiosError({ hasResponse: false }))).toBe(
        true,
      );
    });

    it("returns true for axios errors with 5xx status codes", () => {
      expect(isRetryableError(makeAxiosError({ status: 500 }))).toBe(true);
      expect(isRetryableError(makeAxiosError({ status: 502 }))).toBe(true);
      expect(isRetryableError(makeAxiosError({ status: 503 }))).toBe(true);
      expect(isRetryableError(makeAxiosError({ status: 504 }))).toBe(true);
    });

    it("returns false for axios errors with 4xx status codes", () => {
      expect(isRetryableError(makeAxiosError({ status: 400 }))).toBe(false);
      expect(isRetryableError(makeAxiosError({ status: 401 }))).toBe(false);
      expect(isRetryableError(makeAxiosError({ status: 403 }))).toBe(false);
      expect(isRetryableError(makeAxiosError({ status: 404 }))).toBe(false);
      expect(isRetryableError(makeAxiosError({ status: 422 }))).toBe(false);
    });
  });

  describe("errorMessage", () => {
    it("extracts message from Error instances", () => {
      expect(errorMessage(new Error("test error"))).toBe("test error");
    });

    it("converts non-Error values to string", () => {
      expect(errorMessage("string error")).toBe("string error");
      expect(errorMessage(404)).toBe("404");
      expect(errorMessage({ custom: "obj" })).toBe("[object Object]");
    });
  });

  describe("summarizeResponseShape", () => {
    it("summarizes arrays with type and length", () => {
      expect(summarizeResponseShape([])).toEqual({ type: "array", length: 0 });
      expect(summarizeResponseShape([1, 2, 3])).toEqual({
        type: "array",
        length: 3,
      });
    });

    it("summarizes objects with type and top-level keys", () => {
      expect(summarizeResponseShape({})).toEqual({
        type: "object",
        keys: [],
      });
      expect(
        summarizeResponseShape({
          id: "123",
          name: "test",
          details: { foo: "bar" },
        }),
      ).toEqual({
        type: "object",
        keys: ["id", "name", "details"],
      });
    });

    it("summarizes primitives with type", () => {
      expect(summarizeResponseShape("hello")).toEqual({ type: "string" });
      expect(summarizeResponseShape(42)).toEqual({ type: "number" });
      expect(summarizeResponseShape(true)).toEqual({ type: "boolean" });
      expect(summarizeResponseShape(null)).toEqual({ type: "object" });
      expect(summarizeResponseShape(undefined)).toEqual({ type: "undefined" });
    });
  });

  describe("withRetry", () => {
    const context: CallContext = {
      clientName: "test-client",
      operation: "testOp",
      method: "GET",
      path: "/test",
    };

    it("succeeds on first attempt without logging warning", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn, context, 2, 10);

      expect(result).toEqual({ value: "success", attempts: 1 });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("retries on retryable failure and succeeds", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const fn = vi
        .fn()
        .mockRejectedValueOnce(makeAxiosError({ status: 503 }))
        .mockResolvedValue("recovered");

      const result = await withRetry(fn, context, 2, 5);

      expect(result).toEqual({ value: "recovered", attempts: 2 });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "test-client",
          operation: "testOp",
          event: "retry",
          attempt: 1,
          maxRetries: 2,
        }),
        expect.any(String),
      );
    });

    it("does not retry on non-retryable error", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const fn = vi.fn().mockRejectedValue(makeAxiosError({ status: 400 }));

      await expect(withRetry(fn, context, 2, 5)).rejects.toThrow(
        "axios failure",
      );
      expect(fn).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("exhausts retries and rethrows error", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const fn = vi.fn().mockRejectedValue(makeAxiosError({ status: 500 }));

      await expect(withRetry(fn, context, 2, 5)).rejects.toThrow(
        "axios failure",
      );
      expect(fn).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("requestWithLogging", () => {
    const context: CallContext = {
      clientName: "test-client",
      operation: "testOp",
      method: "POST",
      path: "/test-path",
      requestId: "req-123",
    };

    it("logs request_start and request_complete on success", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      const mockResponse = {
        status: 200,
        data: { ok: true },
      } as unknown as AxiosResponse;

      const result = await requestWithLogging(
        context,
        async () => mockResponse,
      );

      expect(result).toBe(mockResponse);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "test-client",
          operation: "testOp",
          method: "POST",
          path: "/test-path",
          requestId: "req-123",
          event: "request_start",
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "test-client",
          operation: "testOp",
          event: "request_complete",
          outcome: "success",
          status: 200,
          attempts: 1,
          retried: false,
          durationMs: expect.any(Number),
        }),
        expect.any(String),
      );
    });

    it("logs request_complete with error outcome on failure", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      const error = makeAxiosError({ status: 404 });

      await expect(
        requestWithLogging(context, async () => {
          throw error;
        }),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "test-client",
          operation: "testOp",
          event: "request_complete",
          outcome: "error",
          status: 404,
          requestId: "req-123",
        }),
        expect.any(String),
      );
    });
  });

  describe("logSchemaValidationError", () => {
    it("logs schema_validation_failed with status and shape summary", () => {
      const errorSpy = vi.spyOn(logger, "error");
      const context: CallContext = {
        clientName: "test-client",
        operation: "testOp",
        method: "GET",
        path: "/test-path",
      };

      logSchemaValidationError(
        context,
        200,
        { unexpected: "shape" },
        new Error("schema mismatch"),
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "test-client",
          operation: "testOp",
          event: "schema_validation_failed",
          status: 200,
          responseShape: {
            type: "object",
            keys: ["unexpected"],
          },
          error: "schema mismatch",
        }),
        expect.any(String),
      );
    });
  });
});
