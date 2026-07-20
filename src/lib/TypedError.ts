/**
 * TYPED ERROR HIERARCHY
 *
 * Explicit error types for every failure mode.
 * Enables proper error recovery and circuit breaker logic.
 *
 * All errors must extend BaseError for consistency.
 */

/**
 * Base class for all Sentinel errors
 * Includes context, recovery hint, and severity
 */
export class SentinelError extends Error {
  readonly context: Record<string, any>;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly recoverable: boolean;
  readonly timestamp: number;

  constructor(
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high',
    recoverable: boolean = false,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.severity = severity;
    this.recoverable = recoverable;
    this.timestamp = Date.now();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, SentinelError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context
    };
  }
}

// ============================================================================
// CALCULATION ERRORS
// ============================================================================

/**
 * FloatLib calculation failed
 * Indicates a mathematical operation produced invalid result
 */
export class CalculationError extends SentinelError {
  constructor(
    operation: string,
    inputs: any[],
    reason: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Calculation failed: ${operation} with inputs [${inputs.join(', ')}] - ${reason}`,
      'high',
      false,
      { operation, inputs, reason, ...context }
    );
    Object.setPrototypeOf(this, CalculationError.prototype);
  }
}

/**
 * Precision loss detected in calculation
 * Value exceeded floating point limits
 */
export class PrecisionError extends SentinelError {
  constructor(
    value: string | number,
    precision: number,
    context: Record<string, any> = {}
  ) {
    super(
      `Precision error: value exceeds ${precision} decimal places`,
      'high',
      false,
      { value, precision, ...context }
    );
    Object.setPrototypeOf(this, PrecisionError.prototype);
  }
}

/**
 * Invalid calculation input
 */
export class InvalidCalculationInput extends SentinelError {
  constructor(
    paramName: string,
    value: any,
    reason: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Invalid calculation input ${paramName}: ${value} - ${reason}`,
      'medium',
      false,
      { paramName, value, reason, ...context }
    );
    Object.setPrototypeOf(this, InvalidCalculationInput.prototype);
  }
}

// ============================================================================
// RISK ENGINE ERRORS
// ============================================================================

/**
 * Risk limit exceeded
 * Prevents execution when hard limits are breached
 */
export class RiskLimitExceededError extends SentinelError {
  readonly failedChecks: RiskCheck[];

  constructor(
    failedChecks: RiskCheck[],
    context: Record<string, any> = {}
  ) {
    const checkNames = failedChecks.map(c => c.name).join(', ');
    super(
      `Risk limits exceeded: ${checkNames}`,
      'critical',
      false,
      { failedChecks: failedChecks.map(c => c.toJSON()), ...context }
    );
    this.failedChecks = failedChecks;
    Object.setPrototypeOf(this, RiskLimitExceededError.prototype);
  }
}

/**
 * Position size exceeds limit
 */
export class PositionSizeExceededError extends SentinelError {
  constructor(
    actual: string,
    limit: string,
    capital: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Position size ${actual} exceeds limit ${limit} (capital: ${capital})`,
      'critical',
      false,
      { actual, limit, capital, ...context }
    );
    Object.setPrototypeOf(this, PositionSizeExceededError.prototype);
  }
}

/**
 * Leverage exceeds limit
 */
export class LeverageExceededError extends SentinelError {
  constructor(
    actual: string,
    limit: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Leverage ${actual} exceeds limit ${limit}`,
      'critical',
      false,
      { actual, limit, ...context }
    );
    Object.setPrototypeOf(this, LeverageExceededError.prototype);
  }
}

/**
 * Daily loss limit breached
 */
export class DailyLossExceededError extends SentinelError {
  constructor(
    actual: string,
    limit: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Daily loss ${actual} exceeds limit ${limit}`,
      'critical',
      false,
      { actual, limit, ...context }
    );
    Object.setPrototypeOf(this, DailyLossExceededError.prototype);
  }
}

/**
 * Max drawdown exceeded
 */
export class MaxDrawdownExceededError extends SentinelError {
  constructor(
    actual: string,
    limit: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Max drawdown ${actual} exceeds limit ${limit}`,
      'critical',
      false,
      { actual, limit, ...context }
    );
    Object.setPrototypeOf(this, MaxDrawdownExceededError.prototype);
  }
}

// ============================================================================
// TRADE EXECUTION ERRORS
// ============================================================================

/**
 * Trade execution failed
 * Blockchain/DEX interaction error
 */
export class TradeExecutionError extends SentinelError {
  readonly orderId?: string;

  constructor(
    reason: string,
    orderId?: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Trade execution failed: ${reason}`,
      'high',
      true, // Recoverable - can retry
      { orderId, reason, ...context }
    );
    this.orderId = orderId;
    Object.setPrototypeOf(this, TradeExecutionError.prototype);
  }
}

/**
 * Insufficient liquidity for trade
 */
export class InsufficientLiquidityError extends SentinelError {
  constructor(
    pair: string,
    required: string,
    available: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Insufficient liquidity for ${pair}: need ${required}, available ${available}`,
      'high',
      true,
      { pair, required, available, ...context }
    );
    Object.setPrototypeOf(this, InsufficientLiquidityError.prototype);
  }
}

/**
 * Slippage exceeded acceptable range
 */
export class SlippageExceededError extends SentinelError {
  constructor(
    actual: string,
    maxAllowed: string,
    context: Record<string, any> = {}
  ) {
    super(
      `Slippage ${actual} exceeds max ${maxAllowed}`,
      'high',
      true,
      { actual, maxAllowed, ...context }
    );
    Object.setPrototypeOf(this, SlippageExceededError.prototype);
  }
}

// ============================================================================
// CIRCUIT BREAKER ERRORS
// ============================================================================

/**
 * Circuit breaker is open
 * Too many failures, system rejecting requests
 */
export class CircuitBreakerOpenError extends SentinelError {
  readonly service: string;
  readonly failureCount: number;
  readonly failureThreshold: number;
  readonly nextRetryAt: number;

  constructor(
    service: string,
    failureCount: number,
    failureThreshold: number,
    nextRetryAt: number,
    context: Record<string, any> = {}
  ) {
    super(
      `Circuit breaker open for ${service}: ${failureCount}/${failureThreshold} failures. Retry at ${new Date(nextRetryAt).toISOString()}`,
      'high',
      true, // Will recover when cooldown expires
      { service, failureCount, failureThreshold, nextRetryAt, ...context }
    );
    this.service = service;
    this.failureCount = failureCount;
    this.failureThreshold = failureThreshold;
    this.nextRetryAt = nextRetryAt;
    Object.setPrototypeOf(this, CircuitBreakerOpenError.prototype);
  }
}

/**
 * Service timeout
 * External service didn't respond in time
 */
export class ServiceTimeoutError extends SentinelError {
  constructor(
    service: string,
    timeoutMs: number,
    context: Record<string, any> = {}
  ) {
    super(
      `Service ${service} timed out after ${timeoutMs}ms`,
      'high',
      true,
      { service, timeoutMs, ...context }
    );
    Object.setPrototypeOf(this, ServiceTimeoutError.prototype);
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

/**
 * Invalid input parameters
 */
export class ValidationError extends SentinelError {
  readonly invalidFields: string[];

  constructor(
    message: string,
    invalidFields: string[] = [],
    context: Record<string, any> = {}
  ) {
    super(
      `Validation error: ${message}`,
      'medium',
      false,
      { invalidFields, ...context }
    );
    this.invalidFields = invalidFields;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface RiskCheck {
  name: string;
  passed: boolean;
  limit: string;
  actual: string;
  toJSON(): Record<string, any>;
}

/**
 * Type guard for typed errors
 */
export function isSentinelError(error: unknown): error is SentinelError {
  return error instanceof SentinelError;
}

/**
 * Type guard for recoverable errors
 */
export function isRecoverable(error: SentinelError): boolean {
  return error.recoverable;
}

/**
 * Extract error message with context
 */
export function formatError(error: SentinelError): string {
  const contextStr = Object.entries(error.context)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(', ');

  return `${error.name}: ${error.message}${contextStr ? ` (${contextStr})` : ''}`;
}
