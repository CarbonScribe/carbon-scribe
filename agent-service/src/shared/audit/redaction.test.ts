import { describe, expect, it } from "vitest";
import { REDACTED, redactSensitiveFields } from "./redaction.js";

describe("redactSensitiveFields", () => {
  it("redacts a known-sensitive field at the top level while leaving others visible", () => {
    const result = redactSensitiveFields({
      companyId: "corp-1",
      totalValue: 98000,
    });

    expect(result).toEqual({ companyId: "corp-1", totalValue: REDACTED });
  });

  it("redacts sensitive fields nested inside objects and arrays (a deep pass, not just top-level)", () => {
    const portfolio = {
      companyId: "corp-1",
      totalRetired: 500,
      currentBalance: 1200.5,
      holdings: [
        {
          creditId: "c-1",
          projectId: "p-1",
          projectName: "Amazon REDD+",
          currentValue: 4200,
          quantity: 300,
        },
      ],
    };

    const result = redactSensitiveFields(portfolio) as typeof portfolio & {
      holdings: unknown[];
    };

    expect(result.companyId).toBe("corp-1");
    expect(result.totalRetired).toBe(REDACTED);
    expect(result.currentBalance).toBe(REDACTED);
    expect(result.holdings).toEqual([
      {
        creditId: "c-1",
        projectId: "p-1",
        projectName: "Amazon REDD+",
        currentValue: REDACTED,
        quantity: REDACTED,
      },
    ]);
  });

  it("matches sensitive field names regardless of case or separator style", () => {
    const result = redactSensitiveFields({
      total_value: 1,
      TotalRetired: 2,
      "CURRENT-BALANCE": 3,
    });

    expect(result).toEqual({
      total_value: REDACTED,
      TotalRetired: REDACTED,
      "CURRENT-BALANCE": REDACTED,
    });
  });

  it("parses a JSON-stringified tool output and redacts within it, matching how tool.run() implementations return data", () => {
    const raw = JSON.stringify({
      companyId: "corp-9",
      totalValue: 50000,
      riskRating: "high",
    });

    const result = redactSensitiveFields(raw);

    expect(result).toEqual({
      companyId: "corp-9",
      totalValue: REDACTED,
      riskRating: REDACTED,
    });
  });

  it("leaves a non-JSON string (e.g. a plain-text error message) unchanged", () => {
    const message = "Error: Tool 'get_buyer_portfolio' not found";
    expect(redactSensitiveFields(message)).toBe(message);
  });

  it("leaves non-sensitive fields that are plausible lookup keys or identifiers untouched", () => {
    const input = {
      requestId: "req-1",
      companyId: "corp-1",
      projectId: "p-1",
      methodology: "REDD+",
      activityType: "agroforestry",
    };

    expect(redactSensitiveFields(input)).toEqual(input);
  });

  it("does not redact a generic marketplace listing price, only a company's own portfolio valuation fields", () => {
    // A credit's listed price is public marketplace data, not the kind of
    // company financial position #702 is concerned with (see
    // audit-log.service.test.ts's pre-existing round-trip test, which this
    // must not break).
    const credits = [{ id: "credit-1", price: 12.5 }];
    expect(redactSensitiveFields(credits)).toEqual(credits);
  });

  it("passes null, undefined, numbers, and booleans through unchanged", () => {
    expect(redactSensitiveFields(null)).toBeNull();
    expect(redactSensitiveFields(undefined)).toBeUndefined();
    expect(redactSensitiveFields(42)).toBe(42);
    expect(redactSensitiveFields(true)).toBe(true);
  });

  it("redacts a field even when its value is falsy — sensitivity is about the field name, not its content", () => {
    const result = redactSensitiveFields({ totalValue: 0, email: "" });
    expect(result).toEqual({ totalValue: REDACTED, email: REDACTED });
  });
});
