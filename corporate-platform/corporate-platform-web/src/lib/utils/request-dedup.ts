/**
 * Utilities for preventing race conditions caused by out-of-order async responses.
 *
 * Typical usage pattern:
 *   const dedup = new RequestDeduplicator();
 *   const controller = dedup.start('credits');   // cancels previous 'credits' request
 *   try {
 *     const data = await service.fetch({ signal: controller.signal });
 *     ...
 *   } catch (err) {
 *     if (isAbortError(err)) return;  // intentional cancellation — ignore
 *   }
 */

/**
 * Returns true when an error was caused by an intentional AbortController.abort()
 * call. These should be silently swallowed rather than shown to the user.
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}

/**
 * Manages one AbortController per named resource type.
 * Calling start(key) cancels the previous in-flight request for that key and
 * returns a fresh controller for the caller to attach to the new request.
 */
export class RequestDeduplicator {
  private controllers = new Map<string, AbortController>();

  /**
   * Cancel any existing request for `key` and return a new AbortController.
   * Pass `controller.signal` to the fetch / service call.
   */
  start(key: string): AbortController {
    this.controllers.get(key)?.abort();
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller;
  }

  /** Abort and remove the tracked controller for `key`, if any. */
  cancel(key: string): void {
    this.controllers.get(key)?.abort();
    this.controllers.delete(key);
  }

  /** Abort and remove all tracked controllers. */
  cancelAll(): void {
    this.controllers.forEach((ctrl) => ctrl.abort());
    this.controllers.clear();
  }
}
