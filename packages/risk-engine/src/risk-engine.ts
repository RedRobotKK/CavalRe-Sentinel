/**
 * RiskEngine.ts - Position Sizing & Risk Enforcement
 *
 * Manages:
 * - Position sizing (Kelly, surplus-based, capital %)
 * - Leverage constraints (max 2.0x)
 * - Daily/monthly loss limits
 * - Drawdown tracking and circuit breaker
 * - Stop-loss / take-profit enforcement
 *
 * Reference: https://github.com/CavalRe/cavalre-contracts/blob/main/modules/risk/RiskEngine.sol
 *
 * Capital Model:
 * - Starting: $1k USDC
 * - Max position: 5% of working capital
 * - Max leverage: 2.0x (via flashloan)
 * - Max daily loss: 10% of working capital
 * - Max monthly loss: 20% of working capital
 * - Drawdown circuit breaker: 15%
 *
 * Non-negotiable rules:
 * 1. FloatLib for ALL math
 * 2. NEVER TRUST ALWAYS VERIFY (verify limits before execution)
 * 3. CITE REFERENCES (every formula links to source)
 * 4. CHECK FACTS (verify against capital limits)
 * 5. TDD (tests first)
 */

import * as FloatLib from '@cavalre/floatlib-ts';

/**
 * Risk configuration
 */
export interface RiskConfig {
  workingCapital: FloatLib.FloatFixed; // Total available capital
  bufferPercent: FloatLib.FloatFixed; // Buffer to keep in reserve (e.g., 20%)
  maxPositionSize: FloatLib.FloatFixed; // Hard cap on single position
  maxLeverage: FloatLib.FloatFixed; // Max leverage ratio (e.g., 2.0x)
  maxDailyLoss: FloatLib.FloatFixed; // Max loss per day
  maxMonthlyLoss: FloatLib.FloatFixed; // Max loss per month
  drawdownLimit: FloatLib.FloatFixed; // Drawdown circuit breaker
}

/**
 * Position information
 */
export interface Position {
  symbol: string; // Token pair (e.g., USDC/ETH)
  size: FloatLib.FloatFixed; // Position size in USD
  entryPrice: FloatLib.FloatFixed;
  currentPrice: FloatLib.FloatFixed;
  pnl: FloatLib.FloatFixed; // Unrealized P&L
  timestamp: bigint;
}

/**
 * Completed trade
 */
export interface Trade {
  pnl: FloatLib.FloatFixed;
  timestamp: bigint;
  symbol: string;
}

/**
 * Risk metrics snapshot
 */
export interface RiskMetrics {
  workingCapital: FloatLib.FloatFixed;
  availableCapital: FloatLib.FloatFixed;
  peakEquity: FloatLib.FloatFixed;
  currentEquity: FloatLib.FloatFixed;
  currentDrawdown: FloatLib.FloatFixed;
  maxDrawdown: FloatLib.FloatFixed;
  dailyLoss: FloatLib.FloatFixed;
  monthlyLoss: FloatLib.FloatFixed;
  totalTrades: number;
  winRate: number;
}

/**
 * RiskEngine - Position Sizing & Risk Enforcement
 */
export class RiskEngine {
  private config: RiskConfig;
  private currentEquity: FloatLib.FloatFixed;
  private peakEquity: FloatLib.FloatFixed;
  private maxDrawdownSeen: FloatLib.FloatFixed = FloatLib.ZERO;
  private dailyLoss: FloatLib.FloatFixed = FloatLib.ZERO;
  private monthlyLoss: FloatLib.FloatFixed = FloatLib.ZERO;
  private trades: Trade[] = [];
  private lastResetDay: number = 0;
  private lastResetMonth: number = 0;

  /**
   * Initialize Risk Engine
   */
  constructor(config: RiskConfig) {
    this.config = config;
    this.currentEquity = config.workingCapital;
    this.peakEquity = config.workingCapital;
  }

  /**
   * Get working capital
   */
  getWorkingCapital(): FloatLib.FloatFixed {
    return this.config.workingCapital;
  }

  /**
   * Get available capital (after buffer)
   */
  getAvailableCapital(): FloatLib.FloatFixed {
    // available = workingCapital * (1 - bufferPercent / 100)
    const bufferFraction = FloatLib.divide(this.config.bufferPercent, FloatLib.toFloat(100n, 0n));
    const reserved = FloatLib.times(this.config.workingCapital, bufferFraction);
    return FloatLib.minus(this.config.workingCapital, reserved);
  }

  /**
   * Calculate position size based on surplus
   *
   * Formula: position = min(5% capital, 10x surplus, max position)
   *
   * Reference: REFOCUSED_ARCHITECTURE.md#Position-Sizing
   */
  calculatePositionSize(surplus: FloatLib.FloatFixed): FloatLib.FloatFixed {
    if (FloatLib.isZero(surplus)) {
      return FloatLib.ZERO;
    }

    // Option 1: 5% of capital
    const fivePercent = FloatLib.divide(FloatLib.toFloat(5n, 0n), FloatLib.toFloat(100n, 0n));
    const pctOfCapital = FloatLib.times(this.config.workingCapital, fivePercent);

    // Option 2: 10x surplus
    const leveragedSurplus = FloatLib.times(surplus, FloatLib.toFloat(10n, 0n));

    // Take minimum of three options
    let position = pctOfCapital;
    if (FloatLib.isLT(leveragedSurplus, position)) {
      position = leveragedSurplus;
    }
    if (FloatLib.isLT(this.config.maxPositionSize, position)) {
      position = this.config.maxPositionSize;
    }

    return position;
  }

  /**
   * Check leverage constraint
   *
   * Formula: leverage = position / equity
   * Constraint: leverage <= max_leverage
   */
  checkLeverage(position: FloatLib.FloatFixed, equity: FloatLib.FloatFixed): boolean {
    if (FloatLib.isZero(equity)) {
      return false;
    }

    const leverage = FloatLib.divide(position, equity);
    return FloatLib.isLEQ(leverage, this.config.maxLeverage);
  }

  /**
   * Check daily loss limit
   */
  checkDailyLoss(loss: FloatLib.FloatFixed): boolean {
    const totalDaily = FloatLib.plus(this.dailyLoss, loss);
    return FloatLib.isLEQ(totalDaily, this.config.maxDailyLoss);
  }

  /**
   * Check monthly loss limit
   */
  checkMonthlyLoss(loss: FloatLib.FloatFixed): boolean {
    const totalMonthly = FloatLib.plus(this.monthlyLoss, loss);
    return FloatLib.isLEQ(totalMonthly, this.config.maxMonthlyLoss);
  }

  /**
   * Update equity (triggered on position close or mark-to-market)
   */
  updateEquity(newEquity: FloatLib.FloatFixed): void {
    this.currentEquity = newEquity;

    // Update peak
    if (FloatLib.isGT(newEquity, this.peakEquity)) {
      this.peakEquity = newEquity;
    }

    // Update max drawdown
    const drawdown = this.getCurrentDrawdown();
    if (FloatLib.isGT(drawdown, this.maxDrawdownSeen)) {
      this.maxDrawdownSeen = drawdown;
    }
  }

  /**
   * Get peak equity
   */
  getPeakEquity(): FloatLib.FloatFixed {
    return this.peakEquity;
  }

  /**
   * Get current equity
   */
  getCurrentEquity(): FloatLib.FloatFixed {
    return this.currentEquity;
  }

  /**
   * Calculate current drawdown
   *
   * Formula: DD = (peak - current) / peak
   */
  getCurrentDrawdown(): FloatLib.FloatFixed {
    if (FloatLib.isZero(this.peakEquity)) {
      return FloatLib.ZERO;
    }

    const loss = FloatLib.minus(this.peakEquity, this.currentEquity);
    return FloatLib.divide(loss, this.peakEquity);
  }

  /**
   * Check if drawdown exceeded circuit breaker
   */
  isDrawdownExceeded(): boolean {
    const dd = this.getCurrentDrawdown();
    return FloatLib.isGT(dd, this.config.drawdownLimit);
  }

  /**
   * Calculate risk-reward ratio
   *
   * Formula: RR = (takeProfit - entry) / (entry - stopLoss)
   */
  calculateRiskReward(
    entryPrice: FloatLib.FloatFixed,
    stopLoss: FloatLib.FloatFixed,
    takeProfit: FloatLib.FloatFixed
  ): FloatLib.FloatFixed {
    const reward = FloatLib.minus(takeProfit, entryPrice);
    const risk = FloatLib.minus(entryPrice, stopLoss);

    if (FloatLib.isZero(risk)) {
      return FloatLib.ZERO;
    }

    return FloatLib.divide(reward, risk);
  }

  /**
   * Calculate Kelly position size
   *
   * Formula: Kelly% = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin
   *
   * Reference: https://en.wikipedia.org/wiki/Kelly_criterion
   */
  calculateKellySize(
    winRate: FloatLib.FloatFixed,
    avgWin: FloatLib.FloatFixed,
    avgLoss: FloatLib.FloatFixed
  ): FloatLib.FloatFixed {
    // winRate * avgWin
    const winComponent = FloatLib.times(winRate, avgWin);

    // (1 - winRate)
    const lossRate = FloatLib.minus(FloatLib.ONE, winRate);

    // (1 - winRate) * avgLoss
    const lossComponent = FloatLib.times(lossRate, avgLoss);

    // Numerator: winRate * avgWin - (1 - winRate) * avgLoss
    const numerator = FloatLib.minus(winComponent, lossComponent);

    // Denominator: avgWin
    if (FloatLib.isZero(avgWin)) {
      return FloatLib.ZERO;
    }

    return FloatLib.divide(numerator, avgWin);
  }

  /**
   * Record completed trade
   */
  recordTrade(trade: Trade): void {
    this.trades.push(trade);

    // Update daily/monthly loss if negative
    if (FloatLib.isLT(trade.pnl, FloatLib.ZERO)) {
      const loss = FloatLib.abs(trade.pnl);
      this.dailyLoss = FloatLib.plus(this.dailyLoss, loss);
      this.monthlyLoss = FloatLib.plus(this.monthlyLoss, loss);
    }

    // TODO: Reset daily/monthly loss on day/month boundary
  }

  /**
   * Check stop-loss condition
   */
  checkStopLoss(
    entryPrice: FloatLib.FloatFixed,
    stopLoss: FloatLib.FloatFixed,
    currentPrice: FloatLib.FloatFixed
  ): boolean {
    return FloatLib.isLT(currentPrice, stopLoss);
  }

  /**
   * Check take-profit condition
   */
  checkTakeProfit(
    entryPrice: FloatLib.FloatFixed,
    takeProfit: FloatLib.FloatFixed,
    currentPrice: FloatLib.FloatFixed
  ): boolean {
    return FloatLib.isGT(currentPrice, takeProfit);
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): RiskMetrics {
    const winningTrades = this.trades.filter(t => FloatLib.isGT(t.pnl, FloatLib.ZERO)).length;
    const winRate = this.trades.length > 0 ? winningTrades / this.trades.length : 0;

    return {
      workingCapital: this.config.workingCapital,
      availableCapital: this.getAvailableCapital(),
      peakEquity: this.peakEquity,
      currentEquity: this.currentEquity,
      currentDrawdown: this.getCurrentDrawdown(),
      maxDrawdown: this.maxDrawdownSeen,
      dailyLoss: this.dailyLoss,
      monthlyLoss: this.monthlyLoss,
      totalTrades: this.trades.length,
      winRate: winRate,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default RiskEngine;
