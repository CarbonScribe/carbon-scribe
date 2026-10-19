import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./shared/logging/logger.js";
import { registerGracefulShutdown } from "./shutdown.js";

function fakeServer(closeImpl: (cb: (err?: Error) => void) => void): Server {
  return { close: vi.fn(closeImpl) } as unknown as Server;
}

function lastSignalHandler(signal: NodeJS.Signals): () => void {
  const handlers = process.listeners(signal);
  const handler = handlers[handlers.length - 1];
  if (typeof handler !== "function") {
    throw new Error(`no ${signal} handler registered`);
  }
  return handler as () => void;
}

describe("registerGracefulShutdown", () => {
  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stops background work and closes the server immediately, but only closes the pool and exits once the in-flight request finishes", async () => {
    let finishInFlightRequest!: (err?: Error) => void;
    const server = fakeServer((cb) => {
      // http.Server.close()'s callback only fires once every connection —
      // including one serving an in-flight request — has closed. Deferring
      // it here simulates that request still being handled.
      finishInFlightRequest = cb;
    });
    const stopBackgroundWork = vi.fn();
    const closePool = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    registerGracefulShutdown({
      server,
      closePool,
      stopBackgroundWork,
      timeoutMs: 10_000,
      exit,
    });

    lastSignalHandler("SIGTERM")();

    expect(stopBackgroundWork).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
    // The in-flight request hasn't finished yet, so neither the pool nor
    // the process should be torn down concurrently with it.
    expect(closePool).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    finishInFlightRequest();

    await vi.waitFor(() => expect(closePool).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it("ignores a second SIGTERM/SIGINT once shutdown is already underway", () => {
    const server = fakeServer(() => {
      // never calls back — shutdown is left in progress for this test
    });
    const stopBackgroundWork = vi.fn();
    const closePool = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    registerGracefulShutdown({
      server,
      closePool,
      stopBackgroundWork,
      timeoutMs: 10_000,
      exit,
    });

    lastSignalHandler("SIGTERM")();
    lastSignalHandler("SIGTERM")();
    lastSignalHandler("SIGINT")();

    expect(stopBackgroundWork).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it("force-exits with code 1 if the server hasn't finished closing within the timeout", () => {
    vi.useFakeTimers();
    const server = fakeServer(() => {
      // never calls back — requests never drain for this test
    });
    const exit = vi.fn();

    registerGracefulShutdown({
      server,
      closePool: vi.fn().mockResolvedValue(undefined),
      stopBackgroundWork: vi.fn(),
      timeoutMs: 15_000,
      exit,
    });

    lastSignalHandler("SIGTERM")();
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15_000);

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("does not force-exit once the server closes cleanly before the timeout", async () => {
    vi.useFakeTimers();
    const server = fakeServer((cb) => cb());
    const exit = vi.fn();

    registerGracefulShutdown({
      server,
      closePool: vi.fn().mockResolvedValue(undefined),
      stopBackgroundWork: vi.fn(),
      timeoutMs: 15_000,
      exit,
    });

    lastSignalHandler("SIGTERM")();
    // Let the already-resolved close()/closePool() promise chain settle
    // before asserting, since fake timers don't affect microtask ordering.
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    vi.advanceTimersByTime(15_000);

    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("logs a clear shutdown-start and shutdown-complete message", async () => {
    const infoSpy = vi.spyOn(logger, "info");
    const server = fakeServer((cb) => cb());

    registerGracefulShutdown({
      server,
      closePool: vi.fn().mockResolvedValue(undefined),
      stopBackgroundWork: vi.fn(),
      timeoutMs: 10_000,
      exit: vi.fn(),
    });

    lastSignalHandler("SIGTERM")();

    await vi.waitFor(() =>
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ signal: "SIGTERM" }),
        expect.stringContaining("shutdown starting"),
      ),
    );
    await vi.waitFor(() =>
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ signal: "SIGTERM" }),
        expect.stringContaining("shutdown complete"),
      ),
    );
  });
});
