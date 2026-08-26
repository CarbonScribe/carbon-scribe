import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();

vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: {
      ...actual.default,
      create: () => ({ get: getMock }),
    },
  };
});

const { corporatePlatformClient } =
  await import("./corporate-platform.client.js");
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
  });

  it("returns the validated, typed portfolio for a company", async () => {
    getMock.mockResolvedValue({ data: mockPortfolioResponseBody });

    const result =
      await corporatePlatformClient.getPortfolio("company-fixture-1");

    expect(result).toEqual(mockPortfolio);
    expect(getMock).toHaveBeenCalledWith("/api/v1/portfolio/company-fixture-1");
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
});
