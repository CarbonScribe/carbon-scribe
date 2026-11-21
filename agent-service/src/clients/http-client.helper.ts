import axios, { type AxiosResponse } from "axios";
import { logger } from "../shared/logging/logger.js";

export const MAX_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 250;

/** Options every exported client function accepts for logging/correlation. */
export interface ClientCallOptions {
  /**
   * The calling agent's requestId, threaded through so this call's log
   * lines can be correlated with the agent run / audit-log entry that
   * triggered it. Optional: not every caller has one available to pass
   * yet — a betaZodTool's `run(input)` closure has no access to the agent's
   * AgentRunRequest today, so tool-driven calls currently log without it.
   */
  requestId?: string;
}

export interface CallContext {
  /**
   * Distinguishes which downstream service client originated the call,
   * e.g. "project-portal" or "corporate-platform".
   */
  clientName: string;
  /** Distinguishes which exported function a log line came from. */
  operation: string;
  method: string;
  path: string;
  requestId?: string;
}

export function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }
  // No response at all means the request never completed (network error,
  // timeout, connection reset) — worth retrying. A response with a 4xx
  // status is a permanent rejection and retrying it would just repeat the
  // same failure.
  if (!err.response) {
    return true;
  }
  return err.response.status >= 500;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Retries `fn` on a transient network/5xx failure with exponential
 * backoff, logging a distinct line on each retry attempt (attempt number,
 * the error that triggered it) so a retried call is distinguishable in
 * logs from one that succeeded on the first try. Returns how many
 * attempts it actually took alongside the result — 1 means no retry
 * occurred.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: CallContext,
  maxRetries = MAX_RETRIES,
  baseDelayMs = RETRY_BASE_DELAY_MS,
): Promise<{ value: T; attempts: number }> {
  let attempt = 0;
  for (;;) {
    try {
      const value = await fn();
      return { value, attempts: attempt + 1 };
    } catch (err) {
      if (attempt >= maxRetries || !isRetryableError(err)) {
        throw err;
      }
      logger.warn(
        {
          ...context,
          event: "retry",
          attempt: attempt + 1,
          maxRetries,
          error: errorMessage(err),
        },
        `${context.clientName} client request retry`,
      );
      await delay(baseDelayMs * 2 ** attempt);
      attempt += 1;
    }
  }
}

/**
 * Logs request-start and response-complete (or failure) around `fn`, with
 * method/path/duration/outcome — never the request or response body, by
 * design. `fn` is expected to return the raw axios response; callers do
 * their own schema parsing (and, on a validation failure, their own
 * shape-summary logging) afterward.
 */
export async function requestWithLogging(
  context: CallContext,
  fn: () => Promise<AxiosResponse>,
): Promise<AxiosResponse> {
  const start = Date.now();
  logger.info(
    { ...context, event: "request_start" },
    `${context.clientName} client request start`,
  );

  try {
    const { value: response, attempts } = await withRetry(fn, context);
    logger.info(
      {
        ...context,
        event: "request_complete",
        outcome: "success",
        status: response.status,
        attempts,
        retried: attempts > 1,
        durationMs: Date.now() - start,
      },
      `${context.clientName} client request complete`,
    );
    return response;
  } catch (err) {
    logger.error(
      {
        ...context,
        event: "request_complete",
        outcome: "error",
        status: axios.isAxiosError(err) ? err.response?.status : undefined,
        durationMs: Date.now() - start,
        error: errorMessage(err),
      },
      `${context.clientName} client request failed`,
    );
    throw err;
  }
}

/**
 * A truncated, non-sensitive view of a response body that failed schema
 * validation: top-level keys only (or type/length for an array or
 * primitive), never full values — enough to diagnose a backend contract
 * change (a renamed/missing/retyped field) without risking a dump of
 * potentially sensitive payload data into logs.
 */
export function summarizeResponseShape(data: unknown): unknown {
  if (Array.isArray(data)) {
    return { type: "array", length: data.length };
  }
  if (data !== null && typeof data === "object") {
    return { type: "object", keys: Object.keys(data) };
  }
  return { type: typeof data };
}

/**
 * Logs a schema-validation failure event with response status and
 * summarized body shape, without logging raw sensitive payload data.
 */
export function logSchemaValidationError(
  context: CallContext,
  status: number | undefined,
  data: unknown,
  error: Error | string,
): void {
  logger.error(
    {
      ...context,
      event: "schema_validation_failed",
      status,
      responseShape: summarizeResponseShape(data),
      error: error instanceof Error ? error.message : String(error),
    },
    `${context.clientName} client response failed schema validation`,
  );
}
