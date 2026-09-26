import { describe, it, expect, vi } from "vitest";
import { mockedApiClient } from "./setup";

describe("Mock isolation between test files", () => {
  it("should not leak mock calls between test files", async () => {
    // Set up a mock call in this test
    mockedApiClient.get.mockResolvedValueOnce({ data: "test-data" });

    // Make a call to register it
    await mockedApiClient.get("/test");

    // Verify the mock was called once in this test
    expect(mockedApiClient.get).toHaveBeenCalledTimes(1);

    // This test should not be affected by calls from other test files
    // due to the afterEach vi.clearAllMocks() in setup.ts
  });

  it("should start with fresh mock state", () => {
    // Due to afterEach vi.clearAllMocks(), this should start fresh
    // regardless of what happened in the previous test
    expect(mockedApiClient.get).toHaveBeenCalledTimes(0);
    expect(mockedApiClient.post).toHaveBeenCalledTimes(0);
  });

  it("should allow per-test mock overrides", () => {
    // Override the mock for this specific test
    mockedApiClient.post.mockResolvedValueOnce({ data: "custom-response" });

    // Verify it's a fresh mock for this test
    expect(mockedApiClient.post).toHaveBeenCalledTimes(0);
  });
});
