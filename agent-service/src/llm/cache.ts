import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages.js";

/**
 * Prompt caching support for Anthropic Claude models (#830).
 *
 * Anthropic prompt caching works on a static prefix of the request (tools + system prompt).
 * Claude 3.5 Sonnet and Haiku models require a minimum cacheable prompt length of 1,024 tokens
 * (or 2,048 tokens on Claude 3 Opus).
 *
 * When the combined tool definitions and system prompt exceed the threshold, Anthropic
 * caches the prefix for up to 5 minutes (ephemeral). If an agent's combined prefix is shorter
 * than the model's threshold, Anthropic treats cache_control as a no-op without erroring.
 * We deliberately do NOT add artificial padding to reach the threshold, preserving low latency
 * and token efficiency.
 *
 * Dynamic user input (messages) MUST remain outside the cached prefix so cache hits are maximized
 * across runs and iterations within and across user requests.
 */

/**
 * Wraps a system prompt string into an array of content blocks with
 * `cache_control: { type: "ephemeral" }` placed on the final system block.
 *
 * @param prompt The system prompt string.
 * @returns Array containing a BetaTextBlockParam with ephemeral cache control.
 */
export function cachedSystem(prompt: string): BetaTextBlockParam[] {
  return [
    {
      type: "text",
      text: prompt,
      cache_control: { type: "ephemeral" },
    },
  ];
}
