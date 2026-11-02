import { describe, expect, it } from "vitest";
import {
  assertCitationCoverage,
  assertCitationsForStatus,
  MissingCitationCoverageError,
  MissingCitationsError,
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

describe("assertCitationCoverage (#708)", () => {
  it("passes when every recommended credit is cited", () => {
    expect(() =>
      assertCitationCoverage(
        [{ creditId: "credit-1" }, { creditId: "credit-2" }],
        [{ reference: "credit-1" }, { reference: "credit-2" }],
      ),
    ).not.toThrow();
  });

  it("throws MissingCitationCoverageError when a recommendation lacks a citation", () => {
    expect(() =>
      assertCitationCoverage(
        [{ creditId: "credit-1" }, { creditId: "credit-2" }],
        [{ reference: "credit-1" }],
      ),
    ).toThrow(MissingCitationCoverageError);
  });

  it("names the uncited credit ids in the error", () => {
    try {
      assertCitationCoverage(
        [{ creditId: "credit-2" }],
        [{ reference: "credit-1" }],
      );
    } catch (err) {
      expect((err as MissingCitationCoverageError).uncited).toEqual([
        "credit-2",
      ]);
    }
  });

  it("passes for the legitimate zero-recommendation, zero-citation case", () => {
    expect(() => assertCitationCoverage([], [])).not.toThrow();
  });

  it("passes for zero recommendations even with citations present", () => {
    expect(() =>
      assertCitationCoverage([], [{ reference: "credit-1" }]),
    ).not.toThrow();
  });

  it("accepts a citation matched via a creditId field", () => {
    expect(() =>
      assertCitationCoverage(
        [{ creditId: "credit-1" }],
        [{ reference: "other", creditId: "credit-1" }],
      ),
    ).not.toThrow();
  });
});
