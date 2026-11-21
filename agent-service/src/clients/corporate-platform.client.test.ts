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

const { corporatePlatformClient, RateLimitExceededError } =
  await import("./corporate-platform.client.js");
const { verifyServiceToken } = await import("../shared/auth/service-token.js");
const { logger } = await import("../shared/logging/logger.js");
const {
  mockPortfolioResponseBody,
  mockPortfolio,
  mockMarketplaceCreditsResponseBody,
  mockMarketplaceCreditsResult,
} = await import("./corporate-platform.client.fixtures.js");

function axiosError({
  status,
  hasResponse = true,
  headers,
}: {
  status?: number;
  hasResponse?: boolean;
  headers?: Record<string, unknown>;
}) {
  const err = new Error("request failed") as Error & {
    isAxiosError: boolean;
    response?: { status: number; headers?: Record<string, unknown> };
  };
  err.isAxiosError = true;
  if (hasResponse) {
    err.response = { status: status ?? 500, headers };
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

describe("corporatePlatformClient.listMarketplaceCredits", () => {
  beforeEach(() => {
    getMock.mockReset();
    requestConfigMock.mockReset();
  });

  it("calls /api/v1/marketplace/search with empty query when no filters provided", async () => {
    getMock.mockResolvedValue({ data: mockMarketplaceCreditsResponseBody });

    const result = await corporatePlatformClient.listMarketplaceCredits();

    expect(getMock).toHaveBeenCalledWith("/api/v1/marketplace/search");
    expect(result.data.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it("serialises filters into query params and repeats array values", async () => {
    getMock.mockResolvedValue({ data: mockMarketplaceCreditsResponseBody });

    await corporatePlatformClient.listMarketplaceCredits({
      query: "reforest",
      country: "Brazil",
      methodology: "REDD+",
      standard: "VCS",
      sdgs: [13, 15],
      vintageFrom: 2020,
      vintageTo: 2025,
      priceMin: 10,
      priceMax: 30,
      sortBy: "price",
      sortOrder: "asc",
      page: 1,
      limit: 10,
    });

    const calledUrl = getMock.mock.lastCall?.[0] as string;
    expect(calledUrl).toContain("/api/v1/marketplace/search?");
    const url = new URL(`http://localhost${calledUrl}`);
    expect(url.searchParams.get("query")).toBe("reforest");
    expect(url.searchParams.get("country")).toBe("Brazil");
    expect(url.searchParams.get("methodology")).toBe("REDD+");
    expect(url.searchParams.get("standard")).toBe("VCS");
    expect(url.searchParams.getAll("sdgs")).toEqual(["13", "15"]);
    expect(url.searchParams.get("vintageFrom")).toBe("2020");
    expect(url.searchParams.get("vintageTo")).toBe("2025");
    expect(url.searchParams.get("priceMin")).toBe("10");
    expect(url.searchParams.get("priceMax")).toBe("30");
    expect(url.searchParams.get("sortBy")).toBe("price");
    expect(url.searchParams.get("sortOrder")).toBe("asc");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("attaches a signed agent-service bearer token to outbound requests", async () => {
    getMock.mockResolvedValue({ data: mockMarketplaceCreditsResponseBody });

    await corporatePlatformClient.listMarketplaceCredits();

    const config = requestConfigMock.mock.lastCall?.[0] as {
      headers: { Authorization: string };
    };
    const [scheme, token] = config.headers.Authorization.split(" ");
    expect(scheme).toBe("Bearer");
    expect(
      verifyServiceToken(token, { "agent-service": agentServiceSecret }),
    ).toEqual({ service: "agent-service" });
  });

  it("validates response schema and returns structured typed data", async () => {
    getMock.mockResolvedValue({ data: mockMarketplaceCreditsResponseBody });

    const result = await corporatePlatformClient.listMarketplaceCredits();

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.projectName).toBe("Amazon Basin Reforestation");
    expect(result.data[0]?.pricePerTon).toBe(15.5);
    expect(result.facets.countries).toEqual([
      { value: "Brazil", count: 1 },
      { value: "Kenya", count: 1 },
    ]);
  });

  it("throws on malformed response schema and logs schema validation failure", async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { data: [{ invalid: "credit" }], total: "not-a-number" },
    });

    await expect(
      corporatePlatformClient.listMarketplaceCredits(),
    ).rejects.toThrow();
  });

  it("does not retry 4xx errors like 400 Bad Request", async () => {
    getMock.mockRejectedValue(axiosError({ status: 400 }));

    await expect(
      corporatePlatformClient.listMarketplaceCredits({ page: -1 }),
    ).rejects.toThrow();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx server errors and transient failures up to MAX_RETRIES", async () => {
    getMock
      .mockRejectedValueOnce(axiosError({ status: 502 }))
      .mockResolvedValueOnce({ data: mockMarketplaceCreditsResponseBody });

    const result = await corporatePlatformClient.listMarketplaceCredits();
    expect(result.total).toBe(2);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces 429 Too Many Requests as RateLimitExceededError with retryAfterSeconds", async () => {
    getMock.mockRejectedValue(
      axiosError({
        status: 429,
        headers: { "retry-after": "60" },
      }),
    );

    let caughtError: unknown;
    try {
      await corporatePlatformClient.listMarketplaceCredits();
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(RateLimitExceededError);
    const rateLimitErr = caughtError as RateLimitExceededError;
    expect(rateLimitErr.message).toContain("429");
    expect(rateLimitErr.retryAfterSeconds).toBe(60);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("returns mock fixtures when options.mock is true without calling network", async () => {
    const result = await corporatePlatformClient.listMarketplaceCredits(
      {},
      { mock: true },
    );

    expect(getMock).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("logs request-start and request-complete lines with requestId", async () => {
    const infoSpy = vi.spyOn(logger, "info");
    getMock.mockResolvedValue({
      status: 200,
      data: mockMarketplaceCreditsResponseBody,
    });

    await corporatePlatformClient.listMarketplaceCredits(
      { query: "solar" },
      { requestId: "req-marketplace-1" },
    );

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "listMarketplaceCredits",
        event: "request_start",
        requestId: "req-marketplace-1",
      }),
      expect.any(String),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "listMarketplaceCredits",
        event: "request_complete",
        outcome: "success",
        requestId: "req-marketplace-1",
      }),
      expect.any(String),
    );
  });
});
