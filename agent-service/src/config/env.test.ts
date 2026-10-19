import { afterEach, describe, expect, it, vi } from "vitest";

describe("env configuration", () => {
  it("exports env with mockProjectPortal defaulting to false or boolean value", async () => {
    const { env } = await import("./env.js");
    expect(typeof env.mockProjectPortal).toBe("boolean");
    expect(typeof env.projectPortalBaseUrl).toBe("string");
  });

  describe("agent token-budget settings (#701)", () => {
    const originalIterations = process.env.AGENT_MAX_ITERATIONS;
    const originalTokens = process.env.AGENT_MAX_TOKENS_PER_RUN;

    afterEach(() => {
      if (originalIterations === undefined) {
        delete process.env.AGENT_MAX_ITERATIONS;
      } else {
        process.env.AGENT_MAX_ITERATIONS = originalIterations;
      }
      if (originalTokens === undefined) {
        delete process.env.AGENT_MAX_TOKENS_PER_RUN;
      } else {
        process.env.AGENT_MAX_TOKENS_PER_RUN = originalTokens;
      }
      vi.resetModules();
    });

    it("defaults to the shared budget constants when no env var is set", async () => {
      delete process.env.AGENT_MAX_ITERATIONS;
      delete process.env.AGENT_MAX_TOKENS_PER_RUN;
      vi.resetModules();

      const { env } = await import("./env.js");
      const { DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_TOKENS_PER_RUN } =
        await import("../llm/budget.js");

      expect(env.agentMaxIterations).toBe(DEFAULT_MAX_ITERATIONS);
      expect(env.agentMaxTokensPerRun).toBe(DEFAULT_MAX_TOKENS_PER_RUN);
    });

    it("is overridable via AGENT_MAX_ITERATIONS / AGENT_MAX_TOKENS_PER_RUN without any code change", async () => {
      process.env.AGENT_MAX_ITERATIONS = "3";
      process.env.AGENT_MAX_TOKENS_PER_RUN = "50000";
      vi.resetModules();

      const { env } = await import("./env.js");

      expect(env.agentMaxIterations).toBe(3);
      expect(env.agentMaxTokensPerRun).toBe(50000);
    });
  });

  describe("request body size limit (#704)", () => {
    const original = process.env.MAX_REQUEST_BODY_BYTES;

    afterEach(() => {
      if (original === undefined) {
        delete process.env.MAX_REQUEST_BODY_BYTES;
      } else {
        process.env.MAX_REQUEST_BODY_BYTES = original;
      }
      vi.resetModules();
    });

    it("defaults to the shared body-limit constant when no env var is set", async () => {
      delete process.env.MAX_REQUEST_BODY_BYTES;
      vi.resetModules();

      const { env } = await import("./env.js");
      const { DEFAULT_MAX_REQUEST_BODY_BYTES } =
        await import("../shared/middleware/body-limit.js");

      expect(env.maxRequestBodyBytes).toBe(DEFAULT_MAX_REQUEST_BODY_BYTES);
    });

    it("is overridable via MAX_REQUEST_BODY_BYTES without any code change", async () => {
      process.env.MAX_REQUEST_BODY_BYTES = "2097152";
      vi.resetModules();

      const { env } = await import("./env.js");

      expect(env.maxRequestBodyBytes).toBe(2_097_152);
    });
  });
});
