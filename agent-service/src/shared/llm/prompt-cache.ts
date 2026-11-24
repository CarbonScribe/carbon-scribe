export interface CachedSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * Anthropic prompt caching requires a sufficiently large static prefix.
 * This estimate uses 4 characters per token and a 1024-token breakpoint.
 * The call may omit caching when the tools plus prompt are below that size.
 */
export function cachedSystem(
  prompt: string,
  staticTools: unknown[] = [],
): CachedSystemBlock[] {
  const staticPrefixLength = prompt.length + JSON.stringify(staticTools).length;
  const estimatedTokens = Math.ceil(staticPrefixLength / 4);
  if (estimatedTokens < 1024) {
    // The model may treat a sub-1024-token static prefix as a caching no-op.
    // The breakpoint is still installed; callers should measure cache reads
    // rather than padding static prompts to manufacture cache behavior.
  }

  return [{ type: "text", text: prompt, cache_control: { type: "ephemeral" } }];
}
