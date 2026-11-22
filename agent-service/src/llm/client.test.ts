import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { logger } from "../shared/logging/logger.js";
import {
  anthropic,
  createAnthropicClient,
  createAnthropicFetch,
  setAnthropicClient,
} from "./client.js";

describe("Anthropic client retry and backoff configuration (#828)", () => {
  it("initializes shared client with maxRetries and timeout from env", () => {
    expect(anthropic.maxRetries).toBe(env.anthropicMaxRetries);
    expect(anthropic.timeout).toBe(env.anthropicTimeoutMs);
  });

  it("supports creating custom client with overridden maxRetries and timeout", () => {
    const custom = createAnthropicClient({
      apiKey: "test-custom-key",
      maxRetries: 5,
      timeout: 30000,
    });

    expect(custom.maxRetries).toBe(5);
    expect(custom.timeout).toBe(30000);
  });

  it("allows overriding the shared client instance via setAnthropicClient", () => {
    const original = anthropic;
    const mockClient = new Anthropic({ apiKey: "mock-key" });

    try {
      setAnthropicClient(mockClient);
      expect(anthropic).toBe(mockClient);
    } finally {
      setAnthropicClient(original);
    }
  });

  describe("createAnthropicFetch", () => {
    it("logs warn on retryable HTTP error responses (429 with retry-after)", async () => {
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);
      const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
          headers: { "retry-after": "5", "content-type": "application/json" },
        }),
      );

      const wrappedFetch = createAnthropicFetch(fakeFetch);
      const res = await wrappedFetch("https://api.anthropic.com/v1/messages", {
        headers: { "x-stainless-retry-count": "0" },
      });

      expect(res.status).toBe(429);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          client: "anthropic",
          attempt: 1,
          status: 429,
          retryAfter: "5",
        }),
        "Anthropic client request retry",
      );

      warnSpy.mockRestore();
    });

    it("logs warn with updated attempt number on subsequent retry failure (status 500)", async () => {
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);
      const fakeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "server error" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );

      const wrappedFetch = createAnthropicFetch(fakeFetch);
      const res = await wrappedFetch("https://api.anthropic.com/v1/messages", {
        headers: { "x-stainless-retry-count": "1" },
      });

      expect(res.status).toBe(500);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          client: "anthropic",
          attempt: 2,
          status: 500,
        }),
        "Anthropic client request retry",
      );

      warnSpy.mockRestore();
    });

    it("logs warn when underlying fetch throws a network error", async () => {
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);
      const fakeFetch = vi
        .fn()
        .mockRejectedValue(new Error("Connection reset by peer"));

      const wrappedFetch = createAnthropicFetch(fakeFetch);

      await expect(
        wrappedFetch("https://api.anthropic.com/v1/messages", {
          headers: { "x-stainless-retry-count": "0" },
        }),
      ).rejects.toThrow("Connection reset by peer");

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          client: "anthropic",
          attempt: 1,
          error: "Connection reset by peer",
        }),
        "Anthropic client request retry",
      );

      warnSpy.mockRestore();
    });
  });
});
