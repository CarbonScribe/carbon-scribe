import type { Server } from "node:http";
import { logger } from "./shared/logging/logger.js";

export interface GracefulShutdownDeps {
  server: Server;
  /** Ends the audit-log Postgres pool; called only after `server` reports
   *  every connection closed, never concurrently with an in-flight write. */
  closePool: () => Promise<void>;
  /** Stops background polling (outbox dispatcher) so it can't pick up new
   *  work while the process is on its way out. */
  stopBackgroundWork: () => void;
  /** Milliseconds to wait for in-flight requests to drain before forcing
   *  exit, so a stuck connection can't hang a deploy indefinitely. */
  timeoutMs: number;
  /** Overridable for tests; defaults to process.exit. */
  exit?: (code: number) => void;
  /** Overridable for tests so they don't have to wait on real timers. */
  setTimeoutFn?: typeof setTimeout;
}

/**
 * Registers SIGTERM/SIGINT handlers that drain in-flight HTTP requests
 * before exiting (#700). Previously neither signal was handled at all, so
 * the default Node behavior (immediate exit) applied: a deploy could sever
 * an in-flight agent run mid-LLM-call, or abandon an audit-log write
 * mid-query when the process disappeared out from under it.
 *
 * Sequence on first SIGTERM/SIGINT:
 *   1. Stop the outbox dispatcher's poll loop (no new background work).
 *   2. server.close() — stops accepting new connections; existing ones are
 *      allowed to finish.
 *   3. Once every connection has closed, end the audit-log Postgres pool.
 *   4. Exit 0.
 * A second signal while this is in progress is ignored — shutdown is
 * already underway and a repeat signal can't make it happen any faster.
 * If the sequence hasn't finished within timeoutMs, the process force-exits
 * (code 1) rather than hanging a deploy indefinitely.
 */
export function registerGracefulShutdown(deps: GracefulShutdownDeps): void {
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const scheduleTimeout = deps.setTimeoutFn ?? setTimeout;
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "agent-service shutdown starting");

    deps.stopBackgroundWork();

    const forceExitTimer = scheduleTimeout(() => {
      logger.error(
        { signal, timeoutMs: deps.timeoutMs },
        "agent-service shutdown timed out before requests drained, forcing exit",
      );
      exit(1);
    }, deps.timeoutMs);
    forceExitTimer.unref?.();

    deps.server.close((closeErr) => {
      if (closeErr) {
        logger.error(
          { error: closeErr },
          "error while closing agent-service http server",
        );
      }

      deps
        .closePool()
        .catch((poolErr: unknown) => {
          logger.error(
            { error: poolErr },
            "error while closing agent-service audit db pool",
          );
        })
        .finally(() => {
          clearTimeout(forceExitTimer);
          logger.info({ signal }, "agent-service shutdown complete");
          exit(0);
        });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
