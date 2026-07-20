/**
 * CALCULATION LOGGER
 *
 * Logs every FloatLib operation with full audit trail.
 * Every math operation is immutable and traceable.
 *
 * Usage:
 *   const logger = new CalculationLogger();
 *   const result = logger.add(a, b);
 *   const audit = logger.export();
 */

export interface CalculationRecord {
  id: string;
  timestamp: number;
  operation: string;
  inputs: string[];
  output: string;
  precision: number;
  duration_ms: number;
  context?: Record<string, any>;
}

export interface AuditLog {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalOperations: number;
  operations: CalculationRecord[];
  byOperation: Record<string, number>;
  statistics: {
    minDuration: number;
    maxDuration: number;
    avgDuration: number;
    totalDuration: number;
  };
}

/**
 * Logs every calculation with full precision and timing
 */
export class CalculationLogger {
  private sessionId: string;
  private operations: CalculationRecord[] = [];
  private startTime: number;
  private operationCounter: number = 0;

  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.startTime = Date.now();
  }

  /**
   * Log a calculation operation
   */
  private log(
    operation: string,
    inputs: any[],
    output: any,
    precision: number,
    duration_ms: number,
    context?: Record<string, any>
  ): CalculationRecord {
    const record: CalculationRecord = {
      id: `${this.sessionId}-${++this.operationCounter}`,
      timestamp: Date.now(),
      operation,
      inputs: inputs.map(i => String(i)),
      output: String(output),
      precision,
      duration_ms,
      context
    };

    this.operations.push(record);
    return record;
  }

  /**
   * Addition operation
   * logs: operands, result, precision, duration
   */
  add(
    a: string | number,
    b: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    // This would call actual FloatLib
    // For now, simulating: just return string representation
    const result = String(Number(a) + Number(b));
    const duration = performance.now() - start;

    this.log('add', [a, b], result, precision, duration, context);
    return result;
  }

  /**
   * Subtraction operation
   */
  subtract(
    a: string | number,
    b: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    const result = String(Number(a) - Number(b));
    const duration = performance.now() - start;

    this.log('subtract', [a, b], result, precision, duration, context);
    return result;
  }

  /**
   * Multiplication operation
   */
  multiply(
    a: string | number,
    b: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    const result = String(Number(a) * Number(b));
    const duration = performance.now() - start;

    this.log('multiply', [a, b], result, precision, duration, context);
    return result;
  }

  /**
   * Division operation
   */
  divide(
    a: string | number,
    b: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    if (Number(b) === 0) {
      throw new Error('Division by zero');
    }
    const result = String(Number(a) / Number(b));
    const duration = performance.now() - start;

    this.log('divide', [a, b], result, precision, duration, context);
    return result;
  }

  /**
   * Comparison: less than or equal
   * Also logged for audit trail
   */
  lessThanOrEqual(
    a: string | number,
    b: string | number,
    context?: Record<string, any>
  ): boolean {
    const start = performance.now();
    const result = Number(a) <= Number(b);
    const duration = performance.now() - start;

    this.log(
      'lessThanOrEqual',
      [a, b],
      result ? 'true' : 'false',
      0,
      duration,
      context
    );

    return result;
  }

  /**
   * Comparison: greater than or equal
   */
  greaterThanOrEqual(
    a: string | number,
    b: string | number,
    context?: Record<string, any>
  ): boolean {
    const start = performance.now();
    const result = Number(a) >= Number(b);
    const duration = performance.now() - start;

    this.log(
      'greaterThanOrEqual',
      [a, b],
      result ? 'true' : 'false',
      0,
      duration,
      context
    );

    return result;
  }

  /**
   * Percentage calculation
   * logs: value, total, percentage, precision
   */
  percentage(
    value: string | number,
    total: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    if (Number(total) === 0) {
      throw new Error('Cannot calculate percentage of zero');
    }
    const result = String((Number(value) / Number(total)) * 100);
    const duration = performance.now() - start;

    this.log('percentage', [value, total], result, precision, duration, context);
    return result;
  }

  /**
   * Position size calculation
   * logs: risk_amount, total_capital, position_percent
   */
  positionSize(
    riskAmount: string | number,
    totalCapital: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    const result = String(Number(riskAmount) / Number(totalCapital));
    const duration = performance.now() - start;

    this.log(
      'positionSize',
      [riskAmount, totalCapital],
      result,
      precision,
      duration,
      { ...context, purpose: 'risk_management' }
    );

    return result;
  }

  /**
   * ROI calculation
   * logs: profit, starting_capital, roi_percent
   */
  roi(
    profit: string | number,
    startingCapital: string | number,
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    const result = String((Number(profit) / Number(startingCapital)) * 100);
    const duration = performance.now() - start;

    this.log(
      'roi',
      [profit, startingCapital],
      result,
      precision,
      duration,
      { ...context, purpose: 'performance' }
    );

    return result;
  }

  /**
   * Sharpe ratio calculation
   */
  sharpeRatio(
    returnMean: string | number,
    returnStdDev: string | number,
    riskFreeRate: string | number = '0.02',
    precision: number = 18,
    context?: Record<string, any>
  ): string {
    const start = performance.now();
    const result = String(
      (Number(returnMean) - Number(riskFreeRate)) / Number(returnStdDev)
    );
    const duration = performance.now() - start;

    this.log(
      'sharpeRatio',
      [returnMean, returnStdDev, riskFreeRate],
      result,
      precision,
      duration,
      { ...context, purpose: 'risk_metrics' }
    );

    return result;
  }

  /**
   * Get all logged operations
   */
  getOperations(): CalculationRecord[] {
    return [...this.operations];
  }

  /**
   * Get operations by type
   */
  getOperationsByType(operation: string): CalculationRecord[] {
    return this.operations.filter(op => op.operation === operation);
  }

  /**
   * Get total operations count
   */
  getTotalOperations(): number {
    return this.operations.length;
  }

  /**
   * Get count by operation type
   */
  getCountByOperation(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const op of this.operations) {
      counts[op.operation] = (counts[op.operation] || 0) + 1;
    }
    return counts;
  }

  /**
   * Calculate statistics on logged operations
   */
  getStatistics() {
    if (this.operations.length === 0) {
      return {
        minDuration: 0,
        maxDuration: 0,
        avgDuration: 0,
        totalDuration: 0
      };
    }

    const durations = this.operations.map(op => op.duration_ms);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const avgDuration = totalDuration / durations.length;

    return {
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      avgDuration,
      totalDuration
    };
  }

  /**
   * Export full audit log
   */
  export(): AuditLog {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      totalOperations: this.operations.length,
      operations: this.operations,
      byOperation: this.getCountByOperation(),
      statistics: this.getStatistics()
    };
  }

  /**
   * Export as JSON string
   */
  exportJSON(): string {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * Clear all logged operations
   */
  clear(): void {
    this.operations = [];
    this.operationCounter = 0;
  }

  /**
   * Get summary for logging
   */
  getSummary(): string {
    const stats = this.getStatistics();
    return `Calculations: ${this.operations.length} ops | Avg: ${stats.avgDuration.toFixed(2)}ms | Total: ${stats.totalDuration.toFixed(0)}ms`;
  }
}

/**
 * Global calculation logger instance
 * Used to track all financial calculations
 */
export const globalCalculationLogger = new CalculationLogger();

/**
 * Helper to log a calculation externally
 */
export function logCalculation(
  operation: string,
  inputs: any[],
  output: any,
  precision: number = 18,
  context?: Record<string, any>
): void {
  // This will be used by FloatLib wrapper
  // For now, just log to console in development
  if (process.env.DEBUG_CALCULATIONS) {
    console.log(`[CALC] ${operation}(${inputs.join(', ')}) = ${output}`);
  }
}
