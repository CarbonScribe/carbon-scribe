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

const { projectPortalClient } = await import("./project-portal.client.js");
const { mockMethodologiesResponseBody, mockMethodologies } =
  await import("./project-portal.client.fixtures.js");

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

describe("projectPortalClient.getMethodologies", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("returns the validated, typed methodology list", async () => {
    getMock.mockResolvedValue({ data: mockMethodologiesResponseBody });

    const result = await projectPortalClient.getMethodologies();

    expect(result).toEqual(mockMethodologies);
    expect(getMock).toHaveBeenCalledWith("/methodologies");
  });

  it("throws on a malformed response instead of passing it through", async () => {
    getMock.mockResolvedValue({
      data: { methodologies: [{ id: "agroforestry" }] },
    });

    await expect(projectPortalClient.getMethodologies()).rejects.toThrow();
  });

  it("does not retry a 4xx response", async () => {
    getMock.mockRejectedValue(axiosError({ status: 404 }));

    await expect(projectPortalClient.getMethodologies()).rejects.toThrow();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and succeeds", async () => {
    getMock
      .mockRejectedValueOnce(axiosError({ status: 503 }))
      .mockResolvedValueOnce({ data: mockMethodologiesResponseBody });

    const result = await projectPortalClient.getMethodologies();

    expect(result).toEqual(mockMethodologies);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network error with no response and eventually gives up", async () => {
    getMock.mockRejectedValue(axiosError({ hasResponse: false }));

    await expect(projectPortalClient.getMethodologies()).rejects.toThrow();
    // Initial attempt + MAX_RETRIES retries.
    expect(getMock).toHaveBeenCalledTimes(3);
  });
});
