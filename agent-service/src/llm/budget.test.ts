import { describe, expect, it } from "vitest";
import { runWithTokenBudget, type BudgetedTurn } from "./budget.js";

function fakeRunner(
  turns: BudgetedTurn[],
  options: { error?: unknown; onYield?: () => void } = {},
): AsyncIterable<BudgetedTurn> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const turn of turns) {
        options.onYield?.();
        yield turn;
      }
      if (options.error !== undefined) {
        throw options.error;
      }
    },
  };
}

describe("runWithTokenBudget", () => {
  it("sums input_tokens + output_tokens across every turn and returns the last one when the run stays within budget", async () => {
    const turns: BudgetedTurn[] = [
      { usage: { input_tokens: 100, output_tokens: 50 } },
      { usage: { input_tokens: 80, output_tokens: 20 } },
    ];

    const result = await runWithTokenBudget(fakeRunner(turns), {
      maxTokensPerRun: 1000,
    });

    expect(result.cumulativeTokens).toBe(250);
    expect(result.budgetExceeded).toBe(false);
    expect(result.error).toBeUndefined();
    expect(result.message).toBe(turns[1]);
  });

  it("aborts as soon as cumulative usage crosses the budget, without consuming any further turns", async () => {
    let yielded = 0;
    const turns: BudgetedTurn[] = [
      { usage: { input_tokens: 400, output_tokens: 100 } }, // 500, within budget
      { usage: { input_tokens: 400, output_tokens: 200 } }, // +600 = 1100, exceeds
      { usage: { input_tokens: 10, output_tokens: 10 } }, // must never be reached
    ];

    const result = await runWithTokenBudget(
      fakeRunner(turns, { onYield: () => yielded++ }),
      { maxTokensPerRun: 1000 },
    );

    expect(result.budgetExceeded).toBe(true);
    expect(result.cumulativeTokens).toBe(1100);
    expect(result.message).toBe(turns[1]);
    expect(yielded).toBe(2);
  });

  it("treats exactly-at-budget usage as not exceeded", async () => {
    const turns: BudgetedTurn[] = [
      { usage: { input_tokens: 600, output_tokens: 400 } },
    ];

    const result = await runWithTokenBudget(fakeRunner(turns), {
      maxTokensPerRun: 1000,
    });

    expect(result.cumulativeTokens).toBe(1000);
    expect(result.budgetExceeded).toBe(false);
  });

  it("captures a thrown error alongside whatever cumulativeTokens accumulated first, rather than losing it", async () => {
    const turns: BudgetedTurn[] = [
      { usage: { input_tokens: 50, output_tokens: 50 } },
    ];
    const apiError = new Error("rate limited");

    const result = await runWithTokenBudget(
      fakeRunner(turns, { error: apiError }),
      { maxTokensPerRun: 1000 },
    );

    expect(result.error).toBe(apiError);
    expect(result.cumulativeTokens).toBe(100);
    expect(result.budgetExceeded).toBe(false);
    expect(result.message).toBe(turns[0]);
  });

  it("treats a turn with no usage field as contributing zero tokens, rather than throwing", async () => {
    const turns: BudgetedTurn[] = [
      { usage: { input_tokens: 10, output_tokens: 10 } },
      {},
    ];

    const result = await runWithTokenBudget(fakeRunner(turns), {
      maxTokensPerRun: 1000,
    });

    expect(result.cumulativeTokens).toBe(20);
    expect(result.budgetExceeded).toBe(false);
  });

  it("returns message: undefined and no error when the runner produces zero turns and does not throw", async () => {
    const result = await runWithTokenBudget(fakeRunner([]), {
      maxTokensPerRun: 1000,
    });

    expect(result.message).toBeUndefined();
    expect(result.cumulativeTokens).toBe(0);
    expect(result.budgetExceeded).toBe(false);
    expect(result.error).toBeUndefined();
  });
});
