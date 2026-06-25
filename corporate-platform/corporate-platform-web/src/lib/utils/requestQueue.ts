/**
 * Request Queue Manager for Offline Writes
 * Queues mutation requests when offline and retries them when connection is restored
 */

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface QueueState {
  requests: QueuedRequest[];
  isProcessing: boolean;
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
}

class RequestQueueManager {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private storageKey = 'carbon-scribe-request-queue';
  private maxQueueSize = Number(process.env.NEXT_PUBLIC_MAX_QUEUE_SIZE) || 100;
  private maxRetries = Number(process.env.NEXT_PUBLIC_QUEUE_MAX_RETRIES) || 3;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load queued requests from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load request queue from storage:', error);
    }
  }

  /**
   * Save queued requests to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save request queue to storage:', error);
    }
  }

  /**
   * Add a request to the queue
   */
  enqueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>): string {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Request queue is full, dropping oldest request');
      this.queue.shift();
    }

    const queuedRequest: QueuedRequest = {
      ...request,
      id: this.generateId(),
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedRequest);
    this.saveToStorage();

    return queuedRequest.id;
  }

  /**
   * Remove a request from the queue
   */
  dequeue(id: string): void {
    const index = this.queue.findIndex((r) => r.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.saveToStorage();
    }
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return {
      requests: [...this.queue],
      isProcessing: this.isProcessing,
      totalQueued: this.queue.length,
      totalProcessed: this.queue.filter((r) => r.retries > 0).length,
      totalFailed: this.queue.filter((r) => r.retries >= this.maxRetries).length,
    };
  }

  /**
   * Process all queued requests
   */
  async processQueue(
    fetchFn: (url: string, options: RequestInit) => Promise<Response>,
  ): Promise<{ success: number; failed: number }> {
    if (this.isProcessing || this.queue.length === 0) {
      return { success: 0, failed: 0 };
    }

    this.isProcessing = true;
    let success = 0;
    let failed = 0;

    const requestsToProcess = [...this.queue];

    for (const request of requestsToProcess) {
      try {
        const response = await fetchFn(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        if (response.ok) {
          this.dequeue(request.id);
          success++;
        } else {
          request.retries++;
          if (request.retries >= this.maxRetries) {
            this.dequeue(request.id);
            failed++;
          } else {
            this.saveToStorage();
          }
        }
      } catch (error) {
        request.retries++;
        if (request.retries >= this.maxRetries) {
          this.dequeue(request.id);
          failed++;
        } else {
          this.saveToStorage();
        }
      }
    }

    this.isProcessing = false;
    this.saveToStorage();

    return { success, failed };
  }

  /**
   * Clear all queued requests
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Generate a unique ID for queued requests
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get the number of queued requests
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}

// Singleton instance
export const requestQueue = new RequestQueueManager();
