import { vi } from "vitest";

/**
 * Shared test double for the Anthropic client (#712).
 *
 * All four agent test suites previously redeclared this exact mock inline:
 *
 *   const toolRunnerMock = vi.fn();
 *   vi.mock("../../llm/client.js", () => ({
 *     anthropic: {
 *       beta: { messages: { toolRunner: (...args) => toolRunnerMock(...args) } },
 *     },
 *     DEFAULT_MODEL: "claude-opus-5",
 *   }));
 *
 * This module is now the single place that shape lives.
 *
 * Vitest hoists `vi.mock(...)` and requires a *string literal* path, so each
 * agent test file keeps one literal-path `vi.mock` line that delegates to
 * `buildAnthropicClientModule()`. All the shape/state lives here.
 *
 * Agent-specific response payloads (recommendations, sections, triage fields)
 * stay local to each test file — only the mocking mechanics move here.
 */

/** Shared `vi.fn()` backing the mocked toolRunner for the current test file. */
export const toolRunnerMock = vi.fn();

/**
 * Build the module that `vi.mock(".../llm/client.js", ...)` returns.
 * Delegates every call to the shared `toolRunnerMock` so tests can drive it
 * with `toolRunnerMock.mockReturnValue(fakeRunner(...))` exactly as before.
 */
export function buildAnthropicClientModule() {
  return {
    anthropic: {
      beta: {
        messages: {
          toolRunner: (...args: unknown[]) => toolRunnerMock(...args),
        },
      },
    },
    DEFAULT_MODEL: "claude-opus-5",
  };
}
