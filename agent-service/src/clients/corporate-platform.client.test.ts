import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const requestConfigMock = vi.fn();
let requestInterceptor:
  ((config: { headers: Record<string, string> }) => unknown) | undefined;

const agentServiceSecret = "agent-service-test-secret";
vi.stubEnv("AGENT_SERVICE_JWT_SECRET", agentServiceSecret);

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      create: () => ({
        interceptors: {
          request: {
            use: (interceptor: typeof requestInterceptor) => {
              requestInterceptor = interceptor;
            },
          },
        },
        get: (...args: unknown[]) => {
          const config = requestInterceptor?.({ headers: {} });
          requestConfigMock(config);
          return getMock(...args);
        },
      }),
    },
  };
});

const { corporatePlatformClient } =
  await import("./corporate-platform.client.js");
const { verifyServiceToken } = await import("../shared/auth/service-token.js");
const { logger } = await import("../shared/logging/logger.js");
const { mockPortfolioResponseBody, mockPortfolio } =
  await import("./corporate-platform.client.fixtures.js");

function axiosError({
  status,
  hasResponse = true,
}: {
  status?: number;
  hasResponse?: boolean;
}) {
  const err = new Error("request failed") as Error & {
    isAxiosError: boolean;
    response?: { status: number };
  };
  err.isAxiosError = true;
  if (hasResponse) {
    err.response = { status: status ?? 500 };
  }
  return err;
}

describe("corporatePlatformClient.getPortfolio", () => {
  beforeEach(() => {
    getMock.mockReset();
    requestConfigMock.mockReset();
  });

  it("returns the validated, typed portfolio for a company", async () => {
    getMock.mockResolvedValue({ data: mockPortfolioResponseBody });

    const result =
      await corporatePlatformClient.getPortfolio("company-fixture-1");

    expect(result).toEqual(mockPortfolio);
    expect(getMock).toHaveBeenCalledWith("/api/v1/portfolio/company-fixture-1");
  });

  it("attaches a signed agent-service bearer token to outbound requests", async () => {
    getMock.mockResolvedValue({ data: mockPortfolioResponseBody });

    await corporatePlatformClient.getPortfolio("company-fixture-1");

    const config = requestConfigMock.mock.lastCall?.[0] as {
      headers: { Authorization: string };
    };
    const [scheme, token] = config.headers.Authorization.split(" ");
    expect(scheme).toBe("Bearer");
    expect(
      verifyServiceToken(token, { "agent-service": agentServiceSecret }),
    ).toEqual({ service: "agent-service" });
  });

  it("URL-encodes the companyId", async () => {
    getMock.mockResolvedValue({ data: mockPortfolioResponseBody });

    await corporatePlatformClient.getPortfolio("company/with slashes");

    expect(getMock).toHaveBeenCalledWith(
      "/api/v1/portfolio/company%2Fwith%20slashes",
    );
  });

  it("throws on a malformed response instead of passing it through", async () => {
    getMock.mockResolvedValue({
      data: { success: true, data: { companyId: "x" }, timestamp: "bad" },
    });

    await expect(
      corporatePlatformClient.getPortfolio("company-fixture-1"),
    ).rejects.toThrow();
  });

  it("does not retry a 4xx response", async () => {
    getMock.mockRejectedValue(axiosError({ status: 404 }));

    await expect(
      corporatePlatformClient.getPortfolio("missing-company"),
    ).rejects.toThrow();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and succeeds", async () => {
    getMock
      .mockRejectedValueOnce(axiosError({ status: 503 }))
      .mockResolvedValueOnce({ data: mockPortfolioResponseBody });

    const result =
      await corporatePlatformClient.getPortfolio("company-fixture-1");

    expect(result).toEqual(mockPortfolio);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error with no response and eventually gives up", async () => {
    getMock.mockRejectedValue(axiosError({ hasResponse: false }));

    await expect(
      corporatePlatformClient.getPortfolio("company-fixture-1"),
    ).rejects.toThrow();
    // Initial attempt + MAX_RETRIES retries.
    expect(getMock).toHaveBeenCalledTimes(3);
  });

  // #706: request/response logging around every exported client function.
  describe("request/response logging", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs a request-start and a request-complete line, with method/path/status/duration — never the body", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      getMock.mockResolvedValue({
        status: 200,
        data: mockPortfolioResponseBody,
      });

      await corporatePlatformClient.getPortfolio("company-fixture-1");

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getPortfolio",
          method: "GET",
          path: "/api/v1/portfolio/company-fixture-1",
          event: "request_start",
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getPortfolio",
          event: "request_complete",
          outcome: "success",
          status: 200,
          attempts: 1,
          retried: false,
          durationMs: expect.any(Number),
        }),
        expect.any(String),
      );
      // Neither log call's field object carries the response body/holdings.
      for (const call of infoSpy.mock.calls) {
        expect(JSON.stringify(call[0])).not.toContain("holdings");
      }
    });

    it("correlates log lines with the calling agent's requestId when supplied", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      getMock.mockResolvedValue({
        status: 200,
        data: mockPortfolioResponseBody,
      });

      await corporatePlatformClient.getPortfolio("company-fixture-1", {
        requestId: "req-correlate-1",
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req-correlate-1" }),
        expect.any(String),
      );
    });

    it("does not include a requestId field when the caller doesn't supply one", async () => {
      const infoSpy = vi.spyOn(logger, "info");
      getMock.mockResolvedValue({
        status: 200,
        data: mockPortfolioResponseBody,
      });

      await corporatePlatformClient.getPortfolio("company-fixture-1");

      const startCall = infoSpy.mock.calls.find(
        (call) => (call[0] as { event?: string }).event === "request_start",
      );
      expect(
        (startCall?.[0] as { requestId?: string }).requestId,
      ).toBeUndefined();
    });

    it("logs a distinct, attempt-numbered line for a retry, distinguishing it from a first-try success", async () => {
      const warnSpy = vi.spyOn(logger, "warn");
      const infoSpy = vi.spyOn(logger, "info");
      getMock
        .mockRejectedValueOnce(axiosError({ status: 503 }))
        .mockResolvedValueOnce({
          status: 200,
          data: mockPortfolioResponseBody,
        });

      await corporatePlatformClient.getPortfolio("company-fixture-1");

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getPortfolio",
          event: "retry",
          attempt: 1,
          maxRetries: 2,
          error: expect.any(String),
        }),
        expect.any(String),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "request_complete",
          outcome: "success",
          attempts: 2,
          retried: true,
        }),
        expect.any(String),
      );
    });

    it("logs a request-failed line with the error and no retry line for a non-retryable 4xx", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      const warnSpy = vi.spyOn(logger, "warn");
      getMock.mockRejectedValue(axiosError({ status: 404 }));

      await expect(
        corporatePlatformClient.getPortfolio("missing-company"),
      ).rejects.toThrow();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getPortfolio",
          event: "request_complete",
          outcome: "error",
          status: 404,
        }),
        expect.any(String),
      );
    });

    it("logs the response status and a top-level-keys shape summary (not the full body) on a schema-validation failure", async () => {
      const errorSpy = vi.spyOn(logger, "error");
      getMock.mockResolvedValue({
        status: 200,
        data: { success: true, data: { companyId: "x" }, timestamp: "bad" },
      });

      await expect(
        corporatePlatformClient.getPortfolio("company-fixture-1"),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getPortfolio",
          event: "schema_validation_failed",
          status: 200,
          responseShape: {
            type: "object",
            keys: ["success", "data", "timestamp"],
          },
        }),
        expect.any(String),
      );
    });
  });
});
