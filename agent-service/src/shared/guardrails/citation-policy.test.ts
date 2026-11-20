import { describe, expect, it } from "vitest";
import {
  assertCitationsForStatus,
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
