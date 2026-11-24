import Anthropic, { type Middleware } from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { logger } from "../shared/logging/logger.js";

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export const logAnthropicRetries: Middleware = async (request, next) => {
  const parsedRetryCount = Number(
    request.headers.get("x-stainless-retry-count") ?? "0",
  );
  const retryCount =
    Number.isInteger(parsedRetryCount) && parsedRetryCount >= 0
      ? parsedRetryCount
      : 0;

  try {
    const response = await next(request);
    if (
      retryCount < env.anthropicMaxRetries &&
      isRetryableStatus(response.status)
    ) {
      logger.warn(
        {
          attempt: retryCount + 1,
          status: response.status,
          retryAfter: response.headers.get("retry-after") ?? undefined,
        },
        "Anthropic API request retrying",
      );
    }
    return response;
  } catch (error) {
    if (
      retryCount < env.anthropicMaxRetries &&
      error instanceof Anthropic.APIConnectionError
    ) {
      logger.warn(
        {
          attempt: retryCount + 1,
          status: undefined,
          retryAfter: undefined,
          error: error.message,
        },
        "Anthropic API request retrying",
      );
    }
    throw error;
  }
};

export function createAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: env.anthropicApiKey || undefined,
    maxRetries: env.anthropicMaxRetries,
    timeout: env.anthropicTimeoutMs,
    middleware: [logAnthropicRetries],
  });
}

export let anthropic = createAnthropicClient();

export const DEFAULT_MODEL = env.agentModel;

export function setAnthropicClient(client: Anthropic): void {
  anthropic = client;
}
