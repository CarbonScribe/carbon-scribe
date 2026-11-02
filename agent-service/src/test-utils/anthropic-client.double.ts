// Shared test double for the Anthropic client used by every agent test suite.
//
// Before this module existed each agent test file redeclared the same
// `vi.mock("../../llm/client.js", ...)` wiring and the same `fakeRunner`
// async-generator shape. That duplication meant a future SDK change to
// `anthropic.beta.messages.toolRunner`'s return shape had to be fixed in four
// places, with the risk of one file silently drifting. This module is the
// single source of truth for those mechanics; the agent-specific payloads
// (recommendations, sections, ...) stay local to each test file.
//
// The double only needs to support async iteration, which is the only way
// runWithTokenBudget consumes the real runner.

import Anthropic from "@anthropic-ai/sdk";

export interface FakeTurn {
  stop_reason: string;
  content: unknown[];
  usage?: { input_tokens: number; output_tokens: number };
}

export interface FakeRunnerOptions {
  /** A single-turn run (the common case in these tests). */
  finalMessage?: FakeTurn;
  /** A multi-turn run, for exercising cumulative-usage tracking across
   *  turns. Ignored if finalMessage is set. */
  turns?: FakeTurn[];
  error?: unknown;
  messages?: unknown[];
}

// The real BetaToolRunner is both directly awaitable and async-iterable;
// this fake only supports the latter, matching how the agents consume it.
export function fakeRunner({
  finalMessage,
  turns,
  error,
  messages = [],
}: FakeRunnerOptions) {
  const yieldedTurns = turns ?? (finalMessage ? [finalMessage] : []);
  return {
    params: { messages },
    async *[Symbol.asyncIterator]() {
      for (const turn of yieldedTurns) {
        yield turn;
      }
      if (error !== undefined) {
        throw error;
      }
    },
  };
}

export function finalTextMessage(output: unknown): FakeTurn {
  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
  };
}

// Builder for a successful structured-output run: the runner yields one turn
// whose text content is the JSON-serialized payload.
export function successfulRunner(payload: unknown, messages: unknown[] = []): ReturnType<typeof fakeRunner> {
  return fakeRunner({ finalMessage: finalTextMessage(payload), messages });
}

// Builder for a run that ends with a `refusal` stop reason and no content.
export function refusalRunner(messages: unknown[] = []): ReturnType<typeof fakeRunner> {
  return fakeRunner({
    finalMessage: { stop_reason: "refusal", content: [] },
    messages,
  });
}

// Builder for a run whose text output is not valid JSON (unparseable).
export function malformedRunner(text: string, messages: unknown[] = []): ReturnType<typeof fakeRunner> {
  return fakeRunner({
    finalMessage: { stop_reason: "end_turn", content: [{ type: "text", text }] },
    messages,
  });
}

// Builder for a run that throws an Anthropic.APIError (or any error) while
// iterating.
export function errorRunner(error: unknown, messages: unknown[] = []): ReturnType<typeof fakeRunner> {
  return fakeRunner({ error, messages });
}

// Convenience re-export of the SDK error class so tests don't need to import
// the SDK just to construct an API error.
export { Anthropic };
