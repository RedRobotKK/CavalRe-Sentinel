/**
 * CIRCUIT BREAKER PATTERN
 *
 * Prevents cascade failures when external services fail.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, reject all requests
 * - HALF_OPEN: Testing if service recovered
 *
 * Usage:
 *   const breaker = new CircuitBreaker('blockchain', { threshold: 5, timeout: 60000 });
 *   const result = await breaker.execute(() => callBlockchain());
 */

import { CircuitBreakerOpenError } from './TypedError';
import { StructuredLogger } from './StructuredLogger';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number; // Failures before opening
  successThreshold: number; // Successes to close after half-open
  timeout: number; // Milliseconds before attempting half-open
  onStateChange?: (from: CircuitBreakerState, to: CircuitBreakerState) => void;
  logger?: StructuredLogger;
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailure?: number;
  lastSuccess?: number;
  totalRequests: number;
  failureRate: number;
}

/**
 * Generic circuit breaker for any service
 */
export class CircuitBreaker<T> {
  private state: CircuitBreakerState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private readonly serviceName: string;
  private readonly options: Required<CircuitBreakerOptions>;
  private nextHalfOpenAttempt?: number;

  constructor(
    serviceName: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.serviceName = serviceName;
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 60000,
      onStateChange: options.onStateChange,
      logger: options.logger
    };
  }

  /**
   * Check if circuit is open
   * Throws if trying to execute while open
   */
  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if should transition to half-open
      if (
        this.nextHalfOpenAttempt &&
        Date.now() >= this.nextHalfOpenAttempt
      ) {
        this.transitionTo('half-open');
        return false; // Allow attempt
      }
      return true;
    }
    return false;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<R>(fn: () => Promise<R>): Promise<R> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'open') {
      // Check if should attempt half-open
      if (
        this.nextHalfOpenAttempt &&
        Date.now() >= this.nextHalfOpenAttempt
      ) {
        this.transitionTo('half-open');
        // Continue to attempt
      } else {
        // Reject immediately
        throw new CircuitBreakerOpenError(
          this.serviceName,
          this.failureCount,
          this.options.failureThreshold,
          this.nextHalfOpenAttempt || Date.now() + this.options.timeout
        );
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private recordSuccess(): void {
    this.lastSuccessTime = Date.now();

    if (this.state === 'closed') {
      // Stay closed
      this.failureCount = 0;
      return;
    }

    if (this.state === 'half-open') {
      this.successCount++;

      // Check if should close
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo('closed');
      }
      return;
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(error: any): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    if (this.state === 'closed') {
      this.failureCount++;

      // Check if should open
      if (this.failureCount >= this.options.failureThreshold) {
        this.transitionTo('open');
      }
      return;
    }

    if (this.state === 'half-open') {
      // Any failure in half-open goes back to open
      this.transitionTo('open');
      return;
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'open') {
      // Schedule half-open attempt
      this.nextHalfOpenAttempt = Date.now() + this.options.timeout;
      this.failureCount = 0;
      this.successCount = 0;

      this.options.logger?.logCircuitBreakerTriggered({
        service: this.serviceName,
        state: 'open',
        failureCount: this.totalFailures,
        threshold: this.options.failureThreshold,
        action: `Will retry in ${this.options.timeout}ms`
      });
    }

    if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
      this.nextHalfOpenAttempt = undefined;

      this.options.logger?.logCircuitBreakerTriggered({
        service: this.serviceName,
        state: 'closed',
        failureCount: 0,
        threshold: this.options.failureThreshold,
        action: 'Circuit closed, normal operation resumed'
      });
    }

    if (newState === 'half-open') {
      this.successCount = 0;

      this.options.logger?.logCircuitBreakerTriggered({
        service: this.serviceName,
        state: 'half-open',
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
        action: 'Testing if service recovered'
      });
    }

    if (this.options.onStateChange) {
      this.options.onStateChange(oldState, newState);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    const failureRate =
      this.totalRequests > 0
        ? (this.totalFailures / this.totalRequests) * 100
        : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      failureRate
    };
  }

  /**
   * Reset circuit breaker
   * Only use for testing
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.nextHalfOpenAttempt = undefined;
  }

  /**
   * Manually close circuit
   * Use if you know the service recovered
   */
  close(): void {
    this.transitionTo('closed');
  }

  /**
   * Manually open circuit
   * Use if you detect the service is failing
   */
  open(): void {
    this.transitionTo('open');
  }

  /**
   * Get summary for logging
   */
  getSummary(): string {
    const stats = this.getStats();
    return `${this.serviceName}: ${stats.state} | ${stats.totalRequests} requests | ${stats.failureRate.toFixed(1)}% failure rate`;
  }
}

/**
 * Manager for multiple circuit breakers
 * Tracks all breakers and provides unified interface
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker<any>> = new Map();
  private logger?: StructuredLogger;

  constructor(logger?: StructuredLogger) {
    this.logger = logger;
  }

  /**
   * Get or create circuit breaker for service
   */
  getBreaker<T>(
    serviceName: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker<T> {
    if (!this.breakers.has(serviceName)) {
      const breaker = new CircuitBreaker<T>(serviceName, {
        ...options,
        logger: this.logger
      });
      this.breakers.set(serviceName, breaker);
    }

    return this.breakers.get(serviceName) as CircuitBreaker<T>;
  }

  /**
   * Execute with circuit breaker protection
   */
  async execute<R>(
    serviceName: string,
    fn: () => Promise<R>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<R> {
    const breaker = this.getBreaker<R>(serviceName, options);
    return breaker.execute(fn);
  }

  /**
   * Get all breakers
   */
  getAll(): Map<string, CircuitBreaker<any>> {
    return new Map(this.breakers);
  }

  /**
   * Get all statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Check if any breaker is open
   */
  hasOpenBreaker(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.getState() === 'open') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get open breakers
   */
  getOpenBreakers(): string[] {
    const open: string[] = [];
    for (const [name, breaker] of this.breakers) {
      if (breaker.getState() === 'open') {
        open.push(name);
      }
    }
    return open;
  }

  /**
   * Reset all breakers
   * Only for testing
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get summary for logging
   */
  getSummary(): string {
    const summaries = Array.from(this.breakers.values())
      .map(b => b.getSummary())
      .join(' | ');
    return `CircuitBreakers: ${summaries}`;
  }
}

/**
 * Global circuit breaker manager
 */
export const globalCircuitBreakerManager = new CircuitBreakerManager();
