// Shared, cost-aware budget for agent runs (#701). Previously each of the
// four agents hardcoded its own `const MAX_ITERATIONS = 8` with no cap at
// all on cumulative tokens (and therefore cost) consumed across a run's
// turns — a run that used every iteration could spend far more than a
// single-turn estimate suggests, with no way to notice or stop it.

/** Shared fallback for a run's max_iterations, overridable via
 *  AGENT_MAX_ITERATIONS (see config/env.ts). */
export const DEFAULT_MAX_ITERATIONS = 8;

/**
 * Shared fallback for a run's cumulative input+output token budget,
 * overridable via AGENT_MAX_TOKENS_PER_RUN (see config/env.ts).
 *
 * Each turn's `max_tokens: 16000` only bounds that turn's *output*; a full
 * 8-iteration run could emit up to 8 * 16,000 = 128,000 output tokens alone,
 * on top of the input tokens every turn resends (the growing conversation
 * history plus prior tool results). 200,000 cumulative tokens is a generous
 * ceiling for a single legitimate run while still catching a conversation
 * that is burning tokens (and therefore cost) with no end in sight.
 */
export const DEFAULT_MAX_TOKENS_PER_RUN = 200_000;

export interface TokenBudget {
  maxTokensPerRun: number;
}

/** The minimal shape runWithTokenBudget needs from each turn; a real
 *  BetaMessage satisfies this structurally without any SDK type import
 *  here, and a test can hand it a plain object. */
export interface BudgetedTurn {
  usage?: { input_tokens: number; output_tokens: number } | null;
}

export interface BudgetedRunResult<TTurn> {
  /** The last turn produced before the run ended or was aborted. undefined
   *  only if the runner produced no turns at all (its first call failed —
   *  see `error`). */
  message: TTurn | undefined;
  /** Cumulative input+output tokens across every turn actually consumed. */
  cumulativeTokens: number;
  /** True if the run was stopped early for exceeding maxTokensPerRun,
   *  before max_iterations was reached. */
  budgetExceeded: boolean;
  /** Set if the runner itself threw (e.g. a rate limit or connection
   *  error) before completing. cumulativeTokens still reflects whatever
   *  turns completed before the failure. */
  error?: unknown;
}

/**
 * Drives a BetaToolRunner (or any async-iterable of turns with a `usage`
 * field) turn-by-turn instead of letting it run to completion unsupervised,
 * so cumulative token usage can be checked after every turn and the run
 * aborted before it exceeds budget.
 *
 * Breaking out of the `for await` loop here lands inside the runner's
 * internal try/finally *before* it pushes this turn's message onto its
 * history or executes any of its tool calls — so aborting on a budget
 * overrun never executes a tool call for, or spends further tokens on, the
 * turn that crossed the budget.
 *
 * Never throws: if the underlying runner throws (e.g. a rate limit or
 * connection error from the Anthropic API), that error is captured on the
 * result's `error` field instead, alongside whatever cumulativeTokens had
 * already accumulated from turns that completed first.
 */
export async function runWithTokenBudget<TTurn extends BudgetedTurn>(
  runner: AsyncIterable<TTurn>,
  budget: TokenBudget,
): Promise<BudgetedRunResult<TTurn>> {
  let message: TTurn | undefined;
  let cumulativeTokens = 0;

  try {
    for await (const turn of runner) {
      message = turn;
      if (turn.usage) {
        cumulativeTokens += turn.usage.input_tokens + turn.usage.output_tokens;
      }
      if (cumulativeTokens > budget.maxTokensPerRun) {
        return { message, cumulativeTokens, budgetExceeded: true };
      }
    }
  } catch (error) {
    return { message, cumulativeTokens, budgetExceeded: false, error };
  }

  return { message, cumulativeTokens, budgetExceeded: false };
}
