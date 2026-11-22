import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { logger } from "../shared/logging/logger.js";

// TODO: add request-level cost logging here once usage patterns across agents are known.

export type FetchFn = typeof globalThis.fetch;

/**
 * Creates a fetch wrapper that logs retry attempts and retryable failures
 * at `warn` level with attempt number, HTTP status, and retry-after header (#828).
 */
export function createAnthropicFetch(
  baseFetch: FetchFn = globalThis.fetch.bind(globalThis),
): FetchFn {
  return async (
    input: Parameters<FetchFn>[0],
    init?: Parameters<FetchFn>[1],
  ): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const retryCount = Number(headers.get("x-stainless-retry-count") ?? "0");
    try {
      const response = await baseFetch(input, init);
      if (!response.ok) {
        const isRetryable =
          response.status === 408 ||
          response.status === 409 ||
          response.status === 429 ||
          response.status >= 500;
        if (isRetryable) {
          const retryAfter = response.headers.get("retry-after") ?? undefined;
          logger.warn(
            {
              client: "anthropic",
              attempt: retryCount + 1,
              status: response.status,
              ...(retryAfter ? { retryAfter } : {}),
            },
            "Anthropic client request retry",
          );
        }
      }
      return response;
    } catch (err) {
      logger.warn(
        {
          client: "anthropic",
          attempt: retryCount + 1,
          error: err instanceof Error ? err.message : String(err),
        },
        "Anthropic client request retry",
      );
      throw err;
    }
  };
}

/**
 * Retries and timeouts interact multiplicatively: each individual request attempt has a
 * timeout up to `timeout` (defaulting to `env.anthropicTimeoutMs`). A call with `maxRetries`
 * retries (defaulting to `env.anthropicMaxRetries`) may take up to `(1 + maxRetries) * timeout`
 * plus exponential backoff delays before permanently exhausting retries and throwing an error.
 */
export function createAnthropicClient(options?: {
  apiKey?: string;
  maxRetries?: number;
  timeout?: number;
  fetch?: typeof globalThis.fetch;
}): Anthropic {
  return new Anthropic({
    apiKey: options?.apiKey ?? (env.anthropicApiKey || undefined),
    maxRetries: options?.maxRetries ?? env.anthropicMaxRetries,
    timeout: options?.timeout ?? env.anthropicTimeoutMs,
    fetch: createAnthropicFetch(options?.fetch),
  });
}

// Single shared Anthropic client for all agents in this service.
export let anthropic = createAnthropicClient();

export const DEFAULT_MODEL = env.agentModel;

export function setAnthropicClient(client: Anthropic): void {
  anthropic = client;
}
