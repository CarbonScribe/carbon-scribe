import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const modelsRetrieveMock = vi.fn();
vi.mock("../llm/client.js", () => ({
  anthropic: {
    models: { retrieve: (...args: unknown[]) => modelsRetrieveMock(...args) },
  },
  DEFAULT_MODEL: "claude-opus-5",
}));

const corporatePlatformGetMock = vi.fn();
vi.mock("../clients/corporate-platform.client.js", () => ({
  corporatePlatformClient: {
    http: { get: (...args: unknown[]) => corporatePlatformGetMock(...args) },
  },
}));

const projectPortalGetMock = vi.fn();
vi.mock("../clients/project-portal.client.js", () => ({
  projectPortalClient: {
    http: { get: (...args: unknown[]) => projectPortalGetMock(...args) },
  },
}));

const { getReadiness } = await import("./health.service.js");

describe("getReadiness", () => {
  beforeEach(() => {
    modelsRetrieveMock.mockReset();
    corporatePlatformGetMock.mockReset();
    projectPortalGetMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns healthy with per-check latency when every dependency is reachable", async () => {
    modelsRetrieveMock.mockResolvedValue({ id: "claude-opus-5" });
    corporatePlatformGetMock.mockResolvedValue({ status: 200 });
    projectPortalGetMock.mockResolvedValue({ status: 200 });

    const result = await getReadiness();

    expect(result.status).toBe("healthy");
    expect(result.checks.anthropic.status).toBe("healthy");
    expect(result.checks.anthropic.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checks.corporatePlatform.status).toBe("healthy");
    expect(result.checks.projectPortal.status).toBe("healthy");
    expect(typeof result.uptimeSeconds).toBe("number");
  });

  it("returns unhealthy with per-dependency detail when the Anthropic API is down", async () => {
    modelsRetrieveMock.mockRejectedValue(new Error("401 unauthorized"));
    corporatePlatformGetMock.mockResolvedValue({ status: 200 });
    projectPortalGetMock.mockResolvedValue({ status: 200 });

    const result = await getReadiness();

    expect(result.status).toBe("unhealthy");
    expect(result.checks.anthropic).toEqual({
      status: "unhealthy",
      error: "401 unauthorized",
    });
    expect(result.checks.corporatePlatform.status).toBe("healthy");
    expect(result.checks.projectPortal.status).toBe("healthy");
  });

  it("returns unhealthy with per-dependency detail when corporate-platform is unreachable", async () => {
    modelsRetrieveMock.mockResolvedValue({ id: "claude-opus-5" });
    corporatePlatformGetMock.mockRejectedValue(new Error("ECONNREFUSED"));
    projectPortalGetMock.mockResolvedValue({ status: 200 });

    const result = await getReadiness();

    expect(result.status).toBe("unhealthy");
    expect(result.checks.corporatePlatform).toEqual({
      status: "unhealthy",
      error: "ECONNREFUSED",
    });
    expect(result.checks.anthropic.status).toBe("healthy");
    expect(result.checks.projectPortal.status).toBe("healthy");
  });

  it("returns unhealthy with per-dependency detail when project-portal is unreachable", async () => {
    modelsRetrieveMock.mockResolvedValue({ id: "claude-opus-5" });
    corporatePlatformGetMock.mockResolvedValue({ status: 200 });
    projectPortalGetMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await getReadiness();

    expect(result.status).toBe("unhealthy");
    expect(result.checks.projectPortal).toEqual({
      status: "unhealthy",
      error: "ECONNREFUSED",
    });
  });

  it("times out a hung dependency instead of waiting for it forever", async () => {
    vi.useFakeTimers();
    modelsRetrieveMock.mockReturnValue(new Promise(() => {})); // never resolves
    corporatePlatformGetMock.mockResolvedValue({ status: 200 });
    projectPortalGetMock.mockResolvedValue({ status: 200 });

    const resultPromise = getReadiness();
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(result.status).toBe("unhealthy");
    expect(result.checks.anthropic).toEqual({
      status: "unhealthy",
      error: "Anthropic API check timed out",
    });
  });
});
