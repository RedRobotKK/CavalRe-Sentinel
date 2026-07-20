/**
 * RISK VALIDATOR
 *
 * Enforces mandatory hard risk limits.
 * These are ABSOLUTE - cannot be overridden under any circumstances.
 *
 * Hard Limits:
 * - Position Size: Max 5% of capital
 * - Leverage: Max 2x
 * - Daily Loss: Max 10% per day
 * - Max Drawdown: Max 15% lifetime
 *
 * Every check is logged and contributes to metrics.
 */

import { CalculationLogger } from './CalculationLogger';
import { StructuredLogger } from './StructuredLogger';
import { MetricsCollector } from './MetricsCollector';
import {
  RiskLimitExceededError,
  PositionSizeExceededError,
  LeverageExceededError,
  DailyLossExceededError,
  MaxDrawdownExceededError,
  SentinelError
} from './TypedError';

/**
 * Individual risk check result
 */
export interface RiskCheck {
  name: string;
  passed: boolean;
  limit: string;
  actual: string;
  description: string;
  severity: 'warning' | 'error';

  toJSON(): Record<string, any>;
}

/**
 * Complete risk validation result
 */
export interface RiskValidation {
  timestamp: number;
  allChecksPassed: boolean;
  checks: RiskCheck[];
  failedChecks: RiskCheck[];

  export(): Record<string, any>;
}

/**
 * Risk check configuration
 */
export interface RiskConfig {
  positionSizeMax: string; // 0.05 = 5%
  leverageMax: string; // 2.0 = 2x
  dailyLossMax: string; // 0.10 = 10%
  maxDrawdownMax: string; // 0.15 = 15%
}

/**
 * Default risk configuration (Jane Street + Anthropic standards)
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  positionSizeMax: '0.05',
  leverageMax: '2.0',
  dailyLossMax: '0.10',
  maxDrawdownMax: '0.15'
};

/**
 * Individual risk check
 */
class RiskCheckImpl implements RiskCheck {
  constructor(
    readonly name: string,
    readonly passed: boolean,
    readonly limit: string,
    readonly actual: string,
    readonly description: string,
    readonly severity: 'warning' | 'error' = 'error'
  ) {}

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      passed: this.passed,
      limit: this.limit,
      actual: this.actual,
      description: this.description,
      severity: this.severity
    };
  }
}

/**
 * Risk validation result
 */
class RiskValidationImpl implements RiskValidation {
  readonly timestamp: number;
  readonly allChecksPassed: boolean;
  readonly checks: RiskCheck[];
  readonly failedChecks: RiskCheck[];

  constructor(checks: RiskCheck[]) {
    this.timestamp = Date.now();
    this.checks = checks;
    this.failedChecks = checks.filter(c => !c.passed);
    this.allChecksPassed = this.failedChecks.length === 0;
  }

  export(): Record<string, any> {
    return {
      timestamp: this.timestamp,
      allChecksPassed: this.allChecksPassed,
      failedCheckCount: this.failedChecks.length,
      checks: this.checks.map(c => c.toJSON())
    };
  }
}

/**
 * Validates all mandatory risk limits
 * Throws if any limit exceeded
 */
export class RiskValidator {
  private config: RiskConfig;
  private calculationLogger: CalculationLogger;
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;

  constructor(
    calculationLogger: CalculationLogger,
    structuredLogger: StructuredLogger,
    metricsCollector: MetricsCollector,
    config: Partial<RiskConfig> = {}
  ) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
    this.calculationLogger = calculationLogger;
    this.structuredLogger = structuredLogger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Validate all risk limits
   * Throws RiskLimitExceededError if any check fails
   *
   * @param position Current position size (in ETH or USD)
   * @param totalCapital Total capital available
   * @param leverage Current leverage multiplier
   * @param dailyLoss Current day's losses (negative number)
   * @param currentDrawdown Current drawdown from peak
   * @returns RiskValidation with all checks passed
   * @throws RiskLimitExceededError if any limit exceeded
   */
  validate(params: {
    position: string | number;
    totalCapital: string | number;
    leverage: string | number;
    dailyLoss: string | number; // negative = loss
    currentDrawdown: string | number; // 0-1 = 0-100%
    correlationId?: string;
  }): RiskValidation {
    const correlationId = params.correlationId || this.generateCorrelationId();
    const checks: RiskCheck[] = [];

    // Check 1: Position Size
    const positionCheck = this.checkPositionSize(
      params.position,
      params.totalCapital,
      correlationId
    );
    checks.push(positionCheck);

    // Check 2: Leverage
    const leverageCheck = this.checkLeverage(
      params.leverage,
      correlationId
    );
    checks.push(leverageCheck);

    // Check 3: Daily Loss
    const dailyLossCheck = this.checkDailyLoss(
      params.dailyLoss,
      params.totalCapital,
      correlationId
    );
    checks.push(dailyLossCheck);

    // Check 4: Max Drawdown
    const drawdownCheck = this.checkMaxDrawdown(
      params.currentDrawdown,
      correlationId
    );
    checks.push(drawdownCheck);

    // Log all checks
    for (const check of checks) {
      this.logRiskCheck(check, correlationId);
    }

    // Record metrics
    this.metricsCollector.recordRiskCheck();
    if (checks.some(c => !c.passed)) {
      const failedCount = checks.filter(c => !c.passed).length;
      for (let i = 0; i < failedCount; i++) {
        this.metricsCollector.recordRiskViolation();
      }
    }

    // Create validation result
    const validation = new RiskValidationImpl(checks);

    // Throw if any check failed
    if (!validation.allChecksPassed) {
      this.structuredLogger.logError({
        errorType: 'RiskLimitExceededError',
        errorMessage: `${validation.failedChecks.length} risk limit(s) exceeded`,
        context: {
          failedChecks: validation.failedChecks.map(c => ({
            name: c.name,
            limit: c.limit,
            actual: c.actual
          }))
        },
        severity: 'critical',
        correlationId
      });

      throw new RiskLimitExceededError(validation.failedChecks, {
        correlationId
      });
    }

    return validation;
  }

  /**
   * Check position size doesn't exceed 5% of capital
   */
  private checkPositionSize(
    position: string | number,
    totalCapital: string | number,
    correlationId: string
  ): RiskCheck {
    const positionNum = Number(position);
    const capitalNum = Number(totalCapital);
    const positionPercent = positionNum / capitalNum;

    const limitPercent = Number(this.config.positionSizeMax);
    const passed = positionPercent <= limitPercent;

    // Log calculation
    this.calculationLogger.percentage(
      position,
      totalCapital,
      18,
      { purpose: 'position_size_check' }
    );

    return new RiskCheckImpl(
      'PositionSize',
      passed,
      (limitPercent * 100).toFixed(2) + '%',
      (positionPercent * 100).toFixed(2) + '%',
      `Position ${(positionPercent * 100).toFixed(2)}% of capital (max ${(limitPercent * 100).toFixed(2)}%)`
    );
  }

  /**
   * Check leverage doesn't exceed 2x
   */
  private checkLeverage(
    leverage: string | number,
    correlationId: string
  ): RiskCheck {
    const leverageNum = Number(leverage);
    const limitNum = Number(this.config.leverageMax);
    const passed = leverageNum <= limitNum;

    return new RiskCheckImpl(
      'Leverage',
      passed,
      limitNum.toFixed(2) + 'x',
      leverageNum.toFixed(2) + 'x',
      `Leverage ${leverageNum.toFixed(2)}x (max ${limitNum.toFixed(2)}x)`
    );
  }

  /**
   * Check daily loss doesn't exceed 10% of capital
   */
  private checkDailyLoss(
    dailyLoss: string | number,
    totalCapital: string | number,
    correlationId: string
  ): RiskCheck {
    const lossNum = Number(dailyLoss);
    const capitalNum = Number(totalCapital);
    const lossAbs = Math.abs(lossNum); // Make positive for comparison
    const lossPercent = lossAbs / capitalNum;

    const limitPercent = Number(this.config.dailyLossMax);
    const passed = lossPercent <= limitPercent;

    // Log calculation
    this.calculationLogger.percentage(
      lossAbs,
      totalCapital,
      18,
      { purpose: 'daily_loss_check' }
    );

    return new RiskCheckImpl(
      'DailyLoss',
      passed,
      (limitPercent * 100).toFixed(2) + '%',
      (lossPercent * 100).toFixed(2) + '%',
      `Daily loss ${(lossPercent * 100).toFixed(2)}% of capital (max ${(limitPercent * 100).toFixed(2)}%)`
    );
  }

  /**
   * Check max drawdown doesn't exceed 15% lifetime
   */
  private checkMaxDrawdown(
    currentDrawdown: string | number,
    correlationId: string
  ): RiskCheck {
    const drawdownNum = Number(currentDrawdown);
    const limitNum = Number(this.config.maxDrawdownMax);
    const passed = drawdownNum <= limitNum;

    return new RiskCheckImpl(
      'MaxDrawdown',
      passed,
      (limitNum * 100).toFixed(2) + '%',
      (drawdownNum * 100).toFixed(2) + '%',
      `Max drawdown ${(drawdownNum * 100).toFixed(2)}% (max ${(limitNum * 100).toFixed(2)}%)`
    );
  }

  /**
   * Log a risk check to structured logger
   */
  private logRiskCheck(check: RiskCheck, correlationId: string): void {
    this.structuredLogger.logRiskCheck({
      checkName: check.name,
      passed: check.passed,
      limit: check.limit,
      actual: check.actual,
      reason: check.description,
      correlationId
    });
  }

  /**
   * Generate correlation ID for tracing
   */
  private generateCorrelationId(): string {
    return `risk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get current config
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Update config (for testing/runtime adjustment)
   */
  updateConfig(updates: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
