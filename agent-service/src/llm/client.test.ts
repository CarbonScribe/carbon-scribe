import Anthropic, {
  type APIRequest,
  type MiddlewareContext,
} from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import { logger } from "../shared/logging/logger.js";
import {
  anthropic,
  createAnthropicClient,
  logAnthropicRetries,
  setAnthropicClient,
} from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Anthropic client configuration", () => {
  it("uses configured retry and per-attempt timeout values", () => {
    const originalRetries = env.anthropicMaxRetries;
    const originalTimeout = env.anthropicTimeoutMs;
    try {
      env.anthropicMaxRetries = 4;
      env.anthropicTimeoutMs = 45000;

      const client = createAnthropicClient();

      expect(client.maxRetries).toBe(4);
      expect(client.timeout).toBe(45000);
    } finally {
      env.anthropicMaxRetries = originalRetries;
      env.anthropicTimeoutMs = originalTimeout;
    }
  });

  it("keeps setAnthropicClient as the shared-client override", () => {
    const original = anthropic;
    const replacement = new Anthropic({ apiKey: "test-key" });
    try {
      setAnthropicClient(replacement);
      expect(anthropic).toBe(replacement);
    } finally {
      setAnthropicClient(original);
    }
  });

  it("logs a retry-triggering response with attempt, status, and retry-after", async () => {
    const warn = vi.spyOn(logger, "warn");
    const request = {
      headers: new Headers({ "X-Stainless-Retry-Count": "0" }),
    } as unknown as APIRequest;
    const response = new Response(null, {
      status: 429,
      headers: { "retry-after": "3" },
    });

    await logAnthropicRetries(
      request,
      async () => response,
      {} as MiddlewareContext,
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        status: 429,
        retryAfter: "3",
      }),
      "Anthropic API request retrying",
    );
  });

  it.each([
    ["ANTHROPIC_MAX_RETRIES", "0"],
    ["ANTHROPIC_TIMEOUT_MS", "not-a-number"],
  ])("fails fast when %s is invalid", async (variable, value) => {
    vi.stubEnv(variable, value);
    vi.resetModules();

    await expect(import("../config/env.js")).rejects.toThrow(
      `${variable} must be a positive integer`,
    );
  });
});
