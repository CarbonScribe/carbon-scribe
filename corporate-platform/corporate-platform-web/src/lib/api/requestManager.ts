/**
 * RequestManager handles deduplication and cancellation of in-flight API requests.
 */
export class RequestManager {
  private inFlightRequests: Map<string, AbortController> = new Map();

  /**
   * Generates a unique key for the request to handle deduplication.
   */
  public generateKey(method: string, url: string, body?: any): string {
    const stringifiedBody = typeof body === 'string' ? body : JSON.stringify(body || '');
    return `${method.toUpperCase()}:${url}${stringifiedBody ? ':' + stringifiedBody : ''}`;
  }

  /**
   * Registers a request, optionally cancelling duplicate in-flight requests.
   */
  public registerRequest(key: string, abortController: AbortController, deduplicate: boolean = false) {
    if (deduplicate && this.inFlightRequests.has(key)) {
      console.log(`[RequestManager] Cancelling duplicate request: ${key}`);
      this.inFlightRequests.get(key)?.abort('Duplicate request cancelled');
    }
    this.inFlightRequests.set(key, abortController);
  }

  /**
   * Unregisters a completed or failed request.
   */
  public unregisterRequest(key: string) {
    this.inFlightRequests.delete(key);
  }

  /**
   * Cancels all currently in-flight requests. Used primarily during route transitions.
   */
  public cancelAllRequests() {
    if (this.inFlightRequests.size > 0) {
      console.log(`[RequestManager] Cancelling ${this.inFlightRequests.size} in-flight request(s) due to route transition.`);
      for (const [key, controller] of this.inFlightRequests.entries()) {
        controller.abort('Route transition cancelled');
      }
      this.inFlightRequests.clear();
    }
  }
}

export const requestManager = new RequestManager();
