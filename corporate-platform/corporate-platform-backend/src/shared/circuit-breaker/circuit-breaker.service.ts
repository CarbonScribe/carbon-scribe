import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  enabled: boolean;
}

/**
 * Circuit breaker service for protecting against cascading failures
 *
 * Features:
 * - Three states: CLOSED, OPEN, HALF_OPEN
 * - Configurable failure and success thresholds
 * - Automatic reset after timeout
 * - Per-service circuit breakers
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitBreakerState>();
  private readonly defaultConfig: CircuitBreakerConfig;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getCircuitBreakerConfig();
    this.defaultConfig = {
      failureThreshold: config?.failureThreshold || 5,
      successThreshold: config?.successThreshold || 2,
      timeout: config?.timeout || 30000,
      resetTimeout: config?.resetTimeout || 60000,
      enabled: config?.enabled !== false,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    service: string,
    fn: (signal?: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const state = this.getCircuit(service);

    // Check if circuit breaker is enabled
    if (!this.defaultConfig.enabled) {
      return fn(signal);
    }

    // Check if circuit is open
    if (state.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      if (
        Date.now() - state.lastFailureTime >
        this.defaultConfig.resetTimeout
      ) {
        this.logger.log(`Circuit for ${service} transitioning to HALF_OPEN`);
        state.state = CircuitState.HALF_OPEN;
      } else {
        const remaining = Math.ceil(
          (this.defaultConfig.resetTimeout -
            (Date.now() - state.lastFailureTime)) /
            1000,
        );
        throw new Error(
          `Circuit breaker open for ${service} (resets in ${remaining}s)`,
        );
      }
    }

    try {
      const result = await fn(signal);

      // On success in HALF_OPEN state
      if (state.state === CircuitState.HALF_OPEN) {
        state.successCount += 1;
        if (state.successCount >= this.defaultConfig.successThreshold) {
          this.logger.log(`Circuit for ${service} transitioning to CLOSED`);
          state.state = CircuitState.CLOSED;
          state.failureCount = 0;
          state.successCount = 0;
        }
      }

      return result;
    } catch (error) {
      const err = error as Error;

      // Don't count timeout errors as failures (they're already handled)
      if (err.name === 'TimeoutError') {
        throw error;
      }

      state.failureCount += 1;

      if (state.state === CircuitState.CLOSED) {
        if (state.failureCount >= this.defaultConfig.failureThreshold) {
          this.logger.warn(`Circuit for ${service} transitioning to OPEN`);
          state.state = CircuitState.OPEN;
          state.lastFailureTime = Date.now();
          state.successCount = 0;
        }
      } else if (state.state === CircuitState.HALF_OPEN) {
        // Any failure in HALF_OPEN goes back to OPEN
        this.logger.warn(`Circuit for ${service} transitioning back to OPEN`);
        state.state = CircuitState.OPEN;
        state.lastFailureTime = Date.now();
        state.successCount = 0;
      }

      throw error;
    }
  }

  /**
   * Get circuit state for a service
   */
  getCircuit(service: string): CircuitBreakerState {
    if (!this.circuits.has(service)) {
      this.circuits.set(service, new CircuitBreakerState(CircuitState.CLOSED));
    }
    return this.circuits.get(service)!;
  }

  /**
   * Reset circuit for a service
   */
  reset(service: string): void {
    this.circuits.delete(service);
    this.logger.log(`Circuit for ${service} reset`);
  }

  /**
   * Get status of all circuits
   */
  getStatus(): Record<string, { state: CircuitState; failureCount: number }> {
    const status: Record<
      string,
      { state: CircuitState; failureCount: number }
    > = {};
    for (const [service, state] of this.circuits) {
      status[service] = {
        state: state.state,
        failureCount: state.failureCount,
      };
    }
    return status;
  }
}

/**
 * Circuit breaker state
 */
export class CircuitBreakerState {
  public state: CircuitState;
  public failureCount: number;
  public successCount: number;
  public lastFailureTime: number;

  constructor(state: CircuitState) {
    this.state = state;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}
