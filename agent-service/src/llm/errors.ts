import Anthropic from "@anthropic-ai/sdk";

export type ErrorCategory =
  "rate_limited" | "connection_error" | "invalid_request" | "unknown";

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}

/**
 * Classifies Anthropic SDK errors into internal categories for distinct handling.
 * This allows callers to distinguish between transient failures (rate limits, connection errors)
 * and permanent failures (invalid requests) for appropriate retry strategies.
 */
export function classifyAnthropicError(
  err: unknown,
  agentName: string = "agent",
): ClassifiedError {
  if (err instanceof Anthropic.RateLimitError) {
    return {
      category: "rate_limited",
      message: `Rate limit exceeded: ${err.message}`,
      retryable: true,
    };
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return {
      category: "connection_error",
      message: `Connection error: ${err.message}`,
      retryable: true,
    };
  }

  if (err instanceof Anthropic.APIError) {
    // APIError has a status property for HTTP status codes
    const status = err.status;
    if (status) {
      // 4xx errors are generally not retryable (invalid requests)
      // 5xx errors are server-side and may be retryable
      const isRetryable = status >= 500;
      return {
        category: isRetryable ? "connection_error" : "invalid_request",
        message: `API error (${status}): ${err.message}`,
        retryable: isRetryable,
      };
    }
    return {
      category: "unknown",
      message: `Anthropic API error: ${err.message}`,
      retryable: false,
    };
  }

  // Non-Anthropic errors
  return {
    category: "unknown",
    message: `${agentName} tool execution failed: ${
      err instanceof Error ? err.message : String(err)
    }`,
    retryable: false,
  };
}
