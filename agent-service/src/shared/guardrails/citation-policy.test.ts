import { describe, expect, it } from "vitest";
import {
  assertAllRecommendationsCited,
  assertCitationsForStatus,
  MissingCitationsError,
  UncitedRecommendationsError,
} from "./citation-policy.js";

const CITED = [{ source: "marketplace", reference: "credit-1" }];

describe("assertCitationsForStatus (#705)", () => {
  it.each(["drafted", "needs-approval"] as const)(
    "passes for a %s status with at least one citation",
    (status) => {
      expect(() => assertCitationsForStatus(status, CITED)).not.toThrow();
    },
  );

  it.each(["drafted", "needs-approval"] as const)(
    "throws MissingCitationsError for a %s status with zero citations",
    (status) => {
      expect(() => assertCitationsForStatus(status, [])).toThrow(
        MissingCitationsError,
      );
    },
  );

  it("includes the offending status in the thrown error's message", () => {
    expect(() => assertCitationsForStatus("needs-approval", [])).toThrow(
      /needs-approval/,
    );
  });

  it("does not throw for zero citations when allowEmpty is true", () => {
    expect(() =>
      assertCitationsForStatus("drafted", [], { allowEmpty: true }),
    ).not.toThrow();
  });

  it("still requires citations when allowEmpty is false, even explicitly", () => {
    expect(() =>
      assertCitationsForStatus("drafted", [], { allowEmpty: false }),
    ).toThrow(MissingCitationsError);
  });
});

describe("assertAllRecommendationsCited (#708)", () => {
  it("passes when every recommendation has a matching citation", () => {
    const recommendations = [
      { creditId: "credit-1" },
      { creditId: "credit-2" },
    ];
    const citations = [
      { source: "marketplace", reference: "credit-1" },
      { source: "marketplace", reference: "credit-2" },
    ];

    expect(() =>
      assertAllRecommendationsCited(recommendations, citations),
    ).not.toThrow();
  });

  it("throws UncitedRecommendationsError when one recommendation has no matching citation", () => {
    const recommendations = [
      { creditId: "credit-1" },
      { creditId: "credit-2" },
    ];
    const citations = [{ source: "marketplace", reference: "credit-1" }];

    expect(() =>
      assertAllRecommendationsCited(recommendations, citations),
    ).toThrow(UncitedRecommendationsError);
  });

  it("names the specific uncited credit ID in the thrown error", () => {
    const recommendations = [{ creditId: "credit-2" }];

    expect(() => assertAllRecommendationsCited(recommendations, [])).toThrow(
      /credit-2/,
    );
  });

  it("does not throw for a legitimate empty shortlist (zero recommendations, zero citations)", () => {
    expect(() => assertAllRecommendationsCited([], [])).not.toThrow();
  });

  it("throws when there are citations but none reference the recommended credit", () => {
    const recommendations = [{ creditId: "credit-1" }];
    const citations = [
      { source: "marketplace", reference: "credit-unrelated" },
    ];

    expect(() =>
      assertAllRecommendationsCited(recommendations, citations),
    ).toThrow(UncitedRecommendationsError);
  });
});
