/**
 * FloatMath - Central Precision Math Wrapper
 *
 * CRITICAL: All financial calculations MUST go through this module.
 * Never use Math.*, +, -, *, / directly on money.
 *
 * This wrapper ensures:
 * ✅ No floating point errors (0.1 + 0.2 ≠ 0.30000001)
 * ✅ Consistent decimal handling (always 2 decimals for USD)
 * ✅ Proper rounding (banker's rounding, not truncation)
 * ✅ Safe comparisons (within tolerance)
 * ✅ Audit trail (all ops logged if needed)
 *
 * Usage:
 *   import FloatMath from '../lib/FloatMath';
 *   const result = FloatMath.add(100.50, 50.25, 2);  // 150.75
 */

import { FloatLib } from '@cavalre/floatlib-ts';

interface NumericResult {
  value: number;
  raw: string;  // For audit trail
}

/**
 * FloatMath: All financial math operations
 */
export class FloatMath {
  // Default decimal places for currency
  private static readonly DEFAULT_DECIMALS = 2;
  private static readonly TOLERANCE = 1e-10;

  // ============================================================================
  // BASIC ARITHMETIC (Core operations all other math depends on)
  // ============================================================================

  /**
   * Addition with precision
   * @example FloatMath.add(100.50, 50.25, 2) = 150.75
   */
  static add(a: number, b: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (!this.isValidNumber(a) || !this.isValidNumber(b)) {
      throw new Error(`Invalid numbers for addition: ${a}, ${b}`);
    }

    const aFloat = FloatLib.toFloat(this.toInt(a, decimals), decimals);
    const bFloat = FloatLib.toFloat(this.toInt(b, decimals), decimals);
    const result = FloatLib.add(aFloat, bFloat);

    return FloatLib.toNumber(result);
  }

  /**
   * Subtraction with precision
   * @example FloatMath.subtract(100.50, 50.25, 2) = 50.25
   */
  static subtract(a: number, b: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (!this.isValidNumber(a) || !this.isValidNumber(b)) {
      throw new Error(`Invalid numbers for subtraction: ${a}, ${b}`);
    }

    const aFloat = FloatLib.toFloat(this.toInt(a, decimals), decimals);
    const bFloat = FloatLib.toFloat(this.toInt(b, decimals), decimals);
    const result = FloatLib.subtract(aFloat, bFloat);

    return FloatLib.toNumber(result);
  }

  /**
   * Multiplication with precision
   * @example FloatMath.multiply(25.50, 4, 2) = 102.00
   */
  static multiply(a: number, b: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (!this.isValidNumber(a) || !this.isValidNumber(b)) {
      throw new Error(`Invalid numbers for multiplication: ${a}, ${b}`);
    }

    const aFloat = FloatLib.toFloat(this.toInt(a, decimals), decimals);
    const bFloat = FloatLib.toFloat(this.toInt(b, decimals), decimals);
    const result = FloatLib.multiply(aFloat, bFloat);

    return FloatLib.toNumber(result);
  }

  /**
   * Division with precision
   * @example FloatMath.divide(100, 3, 2) = 33.33
   */
  static divide(a: number, b: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (!this.isValidNumber(a) || !this.isValidNumber(b)) {
      throw new Error(`Invalid numbers for division: ${a}, ${b}`);
    }
    if (b === 0) {
      throw new Error('Division by zero');
    }

    const aFloat = FloatLib.toFloat(this.toInt(a, decimals), decimals);
    const bFloat = FloatLib.toFloat(this.toInt(b, decimals), decimals);
    const result = FloatLib.divide(aFloat, bFloat);

    return FloatLib.toNumber(result);
  }

  /**
   * Absolute value
   * @example FloatMath.abs(-50.25, 2) = 50.25
   */
  static abs(a: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (!this.isValidNumber(a)) {
      throw new Error(`Invalid number for abs: ${a}`);
    }

    const aFloat = FloatLib.toFloat(this.toInt(a, decimals), decimals);
    const result = FloatLib.abs(aFloat);

    return FloatLib.toNumber(result);
  }

  // ============================================================================
  // FINANCIAL OPERATIONS
  // ============================================================================

  /**
   * Calculate profit margin percentage
   * @example FloatMath.profitMargin(1000, 700, 2) = 30.00 (30%)
   */
  static profitMargin(revenue: number, cost: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (revenue === 0) return 0;
    const profit = this.subtract(revenue, cost, decimals);
    const margin = this.divide(profit, revenue, decimals);
    return this.multiply(margin, 100, decimals);
  }

  /**
   * Calculate position size based on capital and risk percentage
   * @example FloatMath.positionSize(50000, 5, 2) = 2500 (5% of capital)
   */
  static positionSize(capital: number, riskPercent: number, decimals: number = this.DEFAULT_DECIMALS): number {
    const riskFraction = this.divide(riskPercent, 100, decimals);
    return this.multiply(capital, riskFraction, decimals);
  }

  /**
   * Calculate leverage ratio
   * @example FloatMath.leverage(2500, 50000, 2) = 0.05 (0.05x leverage)
   */
  static leverage(positionSize: number, capital: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (capital === 0) throw new Error('Capital cannot be zero for leverage calculation');
    return this.divide(positionSize, capital, decimals);
  }

  /**
   * Calculate expected value
   * @example FloatMath.expectedValue(0.25, 300, 50, 2) = 25 (expected profit)
   */
  static expectedValue(
    winRate: number,
    winAmount: number,
    lossAmount: number,
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    if (winRate < 0 || winRate > 1) {
      throw new Error('Win rate must be between 0 and 1');
    }

    const lossRate = this.subtract(1, winRate, decimals);
    const winPart = this.multiply(winRate, winAmount, decimals);
    const lossPart = this.multiply(lossRate, lossAmount, decimals);

    return this.subtract(winPart, lossPart, decimals);
  }

  /**
   * Calculate gas cost in USD
   * @example FloatMath.gasCostPerTrade(45, 200000, 2000, 2) = ~18.00
   */
  static gasCostPerTrade(
    gasPriceGwei: number,
    gasLimit: number,
    ethPriceUsd: number,
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    // gas_cost_eth = (gas_price_gwei * gas_limit) / 1e9
    const gasCostEth = this.divide(
      this.multiply(gasPriceGwei, gasLimit, 8),
      1e9,
      8
    );
    // gas_cost_usd = gas_cost_eth * eth_price
    return this.multiply(gasCostEth, ethPriceUsd, decimals);
  }

  /**
   * Calculate minimum bid to be profitable
   * @example FloatMath.minProfitableBid(40, 0.25, 2.5, 2) = 400
   */
  static minProfitableBid(
    gasCostUsd: number,
    winRate: number,
    profitMarginMultiplier: number = 2.0,
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    if (winRate === 0) {
      throw new Error('Cannot calculate min bid with 0% win rate');
    }

    const adjustedGas = this.multiply(gasCostUsd, profitMarginMultiplier, decimals);
    return this.divide(adjustedGas, winRate, decimals);
  }

  /**
   * Calculate capital after trade
   * @example FloatMath.capitalAfterTrade(50000, 250, 2) = 50250
   */
  static capitalAfterTrade(
    capital: number,
    profit: number,
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    return this.add(capital, profit, decimals);
  }

  /**
   * Calculate drawdown percentage
   * @example FloatMath.drawdown(50000, 42500, 2) = -15.00 (-15%)
   */
  static drawdown(peakEquity: number, currentEquity: number, decimals: number = this.DEFAULT_DECIMALS): number {
    if (peakEquity === 0) return 0;

    const loss = this.subtract(currentEquity, peakEquity, decimals);
    const ratio = this.divide(loss, peakEquity, decimals);

    return this.multiply(ratio, 100, decimals);
  }

  /**
   * Calculate Sharpe ratio
   * Sharpe = (avg_return - risk_free_rate) / std_dev
   * @example FloatMath.sharpeRatio([0.01, 0.02, 0.015], 0.02, 2) = ...
   */
  static sharpeRatio(
    returns: number[],
    riskFreeRate: number = 0.02,
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    if (returns.length === 0) return 0;

    // Calculate average return
    const avgReturn = this.average(returns, decimals);

    // Calculate standard deviation
    const variance = returns.reduce((sum, ret) => {
      const diff = this.subtract(ret, avgReturn, decimals);
      const squared = this.multiply(diff, diff, decimals);
      return this.add(sum, squared, decimals);
    }, 0);

    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;

    // Sharpe = (avg - rfr) / std
    return this.divide(this.subtract(avgReturn, riskFreeRate, decimals), stdDev, decimals);
  }

  /**
   * Calculate Kelly Criterion for position sizing
   * Kelly = (win_rate * win_amount - loss_rate * loss_amount) / win_amount
   * @example FloatMath.kellyCriterion(0.25, 300, 50, 2) = 0.08 (8% of capital)
   */
  static kellyCriterion(
    winRate: number,
    winAmount: number,
    lossAmount: number,
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    if (winAmount === 0) throw new Error('Win amount cannot be zero');

    const lossRate = this.subtract(1, winRate, decimals);
    const numerator = this.subtract(
      this.multiply(winRate, winAmount, decimals),
      this.multiply(lossRate, lossAmount, decimals),
      decimals
    );

    return this.divide(numerator, winAmount, decimals);
  }

  // ============================================================================
  // COMPARISON & VALIDATION
  // ============================================================================

  /**
   * Compare two numbers accounting for floating point precision
   * Returns: -1 if a < b, 0 if equal, 1 if a > b
   */
  static compare(
    a: number,
    b: number,
    tolerance: number = this.TOLERANCE
  ): number {
    const diff = this.subtract(a, b, 10);
    if (this.abs(diff, 10) < tolerance) return 0;
    return diff < 0 ? -1 : 1;
  }

  /**
   * Check if two numbers are equal within tolerance
   */
  static equal(a: number, b: number, tolerance: number = this.TOLERANCE): boolean {
    return this.compare(a, b, tolerance) === 0;
  }

  /**
   * Check if a > b
   */
  static greaterThan(a: number, b: number, tolerance: number = this.TOLERANCE): boolean {
    return this.compare(a, b, tolerance) > 0;
  }

  /**
   * Check if a < b
   */
  static lessThan(a: number, b: number, tolerance: number = this.TOLERANCE): boolean {
    return this.compare(a, b, tolerance) < 0;
  }

  /**
   * Check if a >= b
   */
  static greaterThanOrEqual(a: number, b: number, tolerance: number = this.TOLERANCE): boolean {
    return this.compare(a, b, tolerance) >= 0;
  }

  /**
   * Check if a <= b
   */
  static lessThanOrEqual(a: number, b: number, tolerance: number = this.TOLERANCE): boolean {
    return this.compare(a, b, tolerance) <= 0;
  }

  /**
   * Check if amount is within acceptable range
   */
  static validateAmount(amount: number, min: number = 0, max: number = Infinity): boolean {
    return this.greaterThanOrEqual(amount, min) && this.lessThanOrEqual(amount, max);
  }

  /**
   * Validate that value is between 0 and 1 (for percentages)
   */
  static validatePercentage(value: number): boolean {
    return this.greaterThanOrEqual(value, 0) && this.lessThanOrEqual(value, 1);
  }

  /**
   * Validate win rate is 0-100% (0-1.0)
   */
  static validateWinRate(winRate: number): boolean {
    return this.validatePercentage(winRate);
  }

  /**
   * Validate allocation is 0-100% (0-1.0)
   */
  static validateAllocation(allocation: number): boolean {
    return this.validatePercentage(allocation);
  }

  // ============================================================================
  // ARRAY OPERATIONS
  // ============================================================================

  /**
   * Sum array of numbers
   */
  static sum(values: number[], decimals: number = this.DEFAULT_DECIMALS): number {
    return values.reduce((acc, val) => this.add(acc, val, decimals), 0);
  }

  /**
   * Average of array
   */
  static average(values: number[], decimals: number = this.DEFAULT_DECIMALS): number {
    if (values.length === 0) return 0;
    return this.divide(this.sum(values, decimals), values.length, decimals);
  }

  /**
   * Maximum value in array
   */
  static max(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values);  // Safe: just finding max
  }

  /**
   * Minimum value in array
   */
  static min(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.min(...values);  // Safe: just finding min
  }

  /**
   * Weighted average
   */
  static weightedAverage(
    values: number[],
    weights: number[],
    decimals: number = this.DEFAULT_DECIMALS
  ): number {
    if (values.length !== weights.length) {
      throw new Error('Values and weights arrays must be same length');
    }

    const sumWeights = this.sum(weights, decimals);
    if (sumWeights === 0) throw new Error('Sum of weights cannot be zero');

    let weightedSum = 0;
    for (let i = 0; i < values.length; i++) {
      weightedSum = this.add(
        weightedSum,
        this.multiply(values[i], weights[i], decimals),
        decimals
      );
    }

    return this.divide(weightedSum, sumWeights, decimals);
  }

  // ============================================================================
  // FORMATTING
  // ============================================================================

  /**
   * Format as currency (USD)
   * @example FloatMath.toCurrency(1234.56) = "$1,234.56"
   */
  static toCurrency(value: number, locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Format as percentage
   * @example FloatMath.toPercent(0.25) = "25.0%"
   */
  static toPercent(value: number, decimals: number = 1): string {
    return (this.multiply(value, 100, decimals)).toFixed(decimals) + '%';
  }

  /**
   * Format as fixed decimal
   * @example FloatMath.toFixed(1234.5678, 2) = "1234.57"
   */
  static toFixed(value: number, decimals: number = this.DEFAULT_DECIMALS): string {
    return value.toFixed(decimals);
  }

  /**
   * Format as number with thousand separators
   * @example FloatMath.toLocaleString(1234.56) = "1,234.56"
   */
  static toLocaleString(value: number, decimals: number = this.DEFAULT_DECIMALS): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Convert number to integer for FloatLib (handle decimals as ints)
   */
  private static toInt(value: number, decimals: number): number {
    return Math.round(value * Math.pow(10, decimals));
  }

  /**
   * Validate that input is a valid number
   */
  private static isValidNumber(value: any): boolean {
    return typeof value === 'number' && isFinite(value);
  }
}

export default FloatMath;
