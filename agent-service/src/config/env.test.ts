import { describe, expect, it } from "vitest";

describe("env configuration", () => {
  it("exports env with mockProjectPortal defaulting to false or boolean value", async () => {
    const { env } = await import("./env.js");
    expect(typeof env.mockProjectPortal).toBe("boolean");
    expect(typeof env.projectPortalBaseUrl).toBe("string");
  });
});
