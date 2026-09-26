import { beforeEach, describe, expect, it, vi } from "vitest";

const getMethodologiesMock = vi.fn();
vi.mock("../../clients/project-portal.client.js", () => ({
  projectPortalClient: {
    getMethodologies: (...args: unknown[]) => getMethodologiesMock(...args),
  },
}));

const { matchMethodology, pddDraftTools } =
  await import("./pdd-draft.tools.js");
const { mockMethodologies } =
  await import("../../clients/project-portal.client.fixtures.js");

describe("matchMethodology tool", () => {
  beforeEach(() => {
    getMethodologiesMock.mockReset();
    getMethodologiesMock.mockResolvedValue(mockMethodologies);
  });

  it("is registered in pddDraftTools", () => {
    expect(pddDraftTools.map((t) => t.name)).toContain("match_methodology");
  });

  it("matches a globally-applicable methodology by activity type, case-insensitively", async () => {
    const result = await matchMethodology.run({
      activityType: "Agroforestry",
      country: "KE",
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.matched).toBe(true);
    expect(parsed.methodologyId).toBe("agroforestry");
    expect(parsed.requiredDocuments).toEqual(
      mockMethodologies.find((m) => m.id === "agroforestry")?.requiredDocuments,
    );
  });

  it("matches a country-restricted methodology when the country is in its list", async () => {
    const result = await matchMethodology.run({
      activityType: "mangrove restoration",
      country: "ph",
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.matched).toBe(true);
    expect(parsed.methodologyId).toBe("mangrove-restoration");
  });

  it("does not match a country-restricted methodology outside its list", async () => {
    const result = await matchMethodology.run({
      activityType: "mangrove restoration",
      country: "US",
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.matched).toBe(false);
    expect(parsed.availableMethodologies).toEqual(
      mockMethodologies.map((m) => m.name),
    );
  });

  it("reports no match for an unknown activity type", async () => {
    const result = await matchMethodology.run({
      activityType: "asteroid mining",
      country: "US",
    });

    const parsed = JSON.parse(result as string);
    expect(parsed.matched).toBe(false);
  });
});
