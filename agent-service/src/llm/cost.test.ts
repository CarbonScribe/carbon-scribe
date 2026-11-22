import { describe, expect, it } from "vitest";
import { estimateRunCost } from "./cost.js";

describe("estimateRunCost (#829)", () => {
  it("calculates cost for Sonnet model correctly", () => {
    // 10,000 input ($0.03), 2,000 output ($0.03), 1,000 cache write ($0.00375), 5,000 cache read ($0.0015)
    // Total = 0.03 + 0.03 + 0.00375 + 0.0015 = 0.06525
    const cost = estimateRunCost({
      model: "claude-3-5-sonnet-20241022",
      inputTokens: 10_000,
      outputTokens: 2_000,
      cacheCreationInputTokens: 1_000,
      cacheReadInputTokens: 5_000,
    });

    expect(cost).toBe(0.06525);
  });

  it("calculates cost for Opus model correctly", () => {
    // 1,000 input ($0.015), 1,000 output ($0.075) = $0.09
    const cost = estimateRunCost({
      model: "claude-opus-5",
      inputTokens: 1_000,
      outputTokens: 1_000,
    });

    expect(cost).toBe(0.09);
  });

  it("calculates cost for Haiku model correctly", () => {
    // 10,000 input ($0.008), 1,000 output ($0.004) = $0.012
    const cost = estimateRunCost({
      model: "claude-3-5-haiku-20241022",
      inputTokens: 10_000,
      outputTokens: 1_000,
    });

    expect(cost).toBe(0.012);
  });

  it("handles zero token usage gracefully", () => {
    const cost = estimateRunCost({
      model: "claude-3-5-sonnet",
      inputTokens: 0,
      outputTokens: 0,
    });

    expect(cost).toBe(0);
  });
});
