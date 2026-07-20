/**
 * PERFORMANCE CALCULATOR
 *
 * Calculates all trading performance metrics using FloatLib + CalculationLogger.
 *
 * Metrics:
 * - ROI: Return on investment percentage
 * - Win Rate: Percentage of profitable trades
 * - Sharpe Ratio: Risk-adjusted returns
 * - Profit Factor: Total wins / total losses
 * - Max Drawdown: Largest peak-to-trough decline
 * - Sortino Ratio: Downside risk-adjusted returns
 *
 * All calculations are audited and traceable.
 */

import { CalculationLogger } from './CalculationLogger';
import { StructuredLogger } from './StructuredLogger';
import { MetricsCollector } from './MetricsCollector';

/**
 * Trade record
 */
export interface Trade {
  id: string;
  pair: string;
  timestamp: number;
  profitEth: string | number;
  markupApplied: string | number;
  confidence: number;
}

/**
 * Performance metrics result
 */
export interface PerformanceMetrics {
  timestamp: number;
  startingCapital: string;
  currentCapital: string;
  roi: number; // percentage
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRate: number; // 0-1
  totalProfit: string;
  totalLoss: string;
  profitFactor: number;
  averageWin: string;
  averageLoss: string;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number; // 0-1
  currentDrawdownPercent: number; // 0-1
}

/**
 * Calculates performance metrics
 */
export class PerformanceCalculator {
  private calculationLogger: CalculationLogger;
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;

  constructor(
    calculationLogger: CalculationLogger,
    structuredLogger: StructuredLogger,
    metricsCollector: MetricsCollector
  ) {
    this.calculationLogger = calculationLogger;
    this.structuredLogger = structuredLogger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Calculate all performance metrics
   */
  calculate(params: {
    startingCapital: string | number;
    currentCapital: string | number;
    trades: Trade[];
    riskFreeRate?: number; // For Sharpe/Sortino (default 0.02)
    correlationId?: string;
  }): PerformanceMetrics {
    const correlationId = params.correlationId || this.generateCorrelationId();
    const riskFreeRate = params.riskFreeRate ?? 0.02;

    // Calculate ROI
    const roi = this.calculateROI(
      params.currentCapital,
      params.startingCapital,
      correlationId
    );

    // Categorize trades
    const profitableTrades = params.trades.filter(t => Number(t.profitEth) > 0);
    const losingTrades = params.trades.filter(t => Number(t.profitEth) < 0);
    const totalProfit = this.sumTrades(profitableTrades, correlationId);
    const totalLoss = this.sumTrades(losingTrades, correlationId);
    const winRate = params.trades.length > 0
      ? profitableTrades.length / params.trades.length
      : 0;

    // Profit factor
    const profitFactor = this.calculateProfitFactor(totalProfit, totalLoss, correlationId);

    // Average win/loss
    const averageWin = profitableTrades.length > 0
      ? this.calculationLogger.divide(
          totalProfit,
          String(profitableTrades.length),
          18,
          { purpose: 'average_win' }
        )
      : '0';

    const averageLoss = losingTrades.length > 0
      ? this.calculationLogger.divide(
          totalLoss,
          String(losingTrades.length),
          18,
          { purpose: 'average_loss' }
        )
      : '0';

    // Sharpe ratio (annualized returns / volatility)
    const dailyReturns = this.calculateDailyReturns(params.trades, correlationId);
    const volatility = this.calculateVolatility(dailyReturns, correlationId);
    const sharpeRatio = this.calculateSharpeRatio(roi, volatility, riskFreeRate, correlationId);

    // Sortino ratio (annualized returns / downside volatility)
    const sortinoRatio = this.calculateSortinoRatio(roi, dailyReturns, riskFreeRate, correlationId);

    // Drawdown analysis
    const { maxDrawdown, currentDrawdown } = this.calculateDrawdown(params.trades, correlationId);

    // Record metrics to collector
    this.metricsCollector.recordCapital(params.currentCapital);
    this.metricsCollector.recordROI(roi);
    this.metricsCollector.recordWinRate(winRate);
    this.metricsCollector.recordSharpeRatio(sharpeRatio);
    this.metricsCollector.recordMaxDrawdown(maxDrawdown);

    // Log performance calculation
    this.structuredLogger.logError({
      errorType: 'PerformanceCalculated',
      errorMessage: 'Performance metrics calculated',
      context: {
        roi: roi,
        winRate: winRate,
        sharpeRatio: sharpeRatio,
        sortinoRatio: sortinoRatio
      },
      severity: 'low',
      correlationId
    });

    return {
      timestamp: Date.now(),
      startingCapital: String(params.startingCapital),
      currentCapital: String(params.currentCapital),
      roi,
      totalTrades: params.trades.length,
      profitableTrades: profitableTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalProfit,
      totalLoss,
      profitFactor,
      averageWin,
      averageLoss,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      currentDrawdownPercent: currentDrawdown
    };
  }

  /**
   * Calculate ROI percentage
   * ROI = (Current - Starting) / Starting * 100
   */
  private calculateROI(
    currentCapital: string | number,
    startingCapital: string | number,
    correlationId: string
  ): number {
    const profit = this.calculationLogger.subtract(
      String(currentCapital),
      String(startingCapital),
      18,
      { purpose: 'profit_calculation' }
    );

    const roi = this.calculationLogger.divide(
      profit,
      String(startingCapital),
      18,
      { purpose: 'roi_calculation' }
    );

    const roiPercent = this.calculationLogger.multiply(
      roi,
      '100',
      18,
      { purpose: 'roi_to_percent' }
    );

    return Number(roiPercent);
  }

  /**
   * Sum all trades (gains or losses)
   */
  private sumTrades(trades: Trade[], correlationId: string): string {
    let sum = '0';

    for (const trade of trades) {
      sum = this.calculationLogger.add(
        sum,
        String(trade.profitEth),
        18,
        { purpose: 'sum_trades' }
      );
    }

    return sum;
  }

  /**
   * Calculate profit factor (total wins / total losses)
   */
  private calculateProfitFactor(
    totalProfit: string,
    totalLoss: string,
    correlationId: string
  ): number {
    const lossMagnitude = this.calculationLogger.multiply(
      totalLoss,
      '-1', // Make positive
      18,
      { purpose: 'loss_magnitude' }
    );

    if (Number(lossMagnitude) === 0) return Number(totalProfit) > 0 ? 999 : 0;

    const factor = this.calculationLogger.divide(
      totalProfit,
      lossMagnitude,
      18,
      { purpose: 'profit_factor' }
    );

    return Number(factor);
  }

  /**
   * Calculate daily returns
   */
  private calculateDailyReturns(trades: Trade[], correlationId: string): number[] {
    const returns: number[] = [];

    for (const trade of trades) {
      const ret = Number(trade.profitEth);
      if (ret !== 0) {
        returns.push(ret);
      }
    }

    return returns;
  }

  /**
   * Calculate standard deviation (volatility)
   */
  private calculateVolatility(returns: number[], correlationId: string): number {
    if (returns.length === 0) return 0;

    // Mean
    const sum = returns.reduce((a, b) => a + b, 0);
    const mean = sum / returns.length;

    // Variance
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;

    // Std dev
    return Math.sqrt(variance);
  }

  /**
   * Calculate Sharpe ratio
   * Sharpe = (Return - RiskFree) / Volatility
   */
  private calculateSharpeRatio(
    roi: number,
    volatility: number,
    riskFreeRate: number,
    correlationId: string
  ): number {
    const roiDecimal = roi / 100;
    const excessReturn = this.calculationLogger.subtract(
      String(roiDecimal),
      String(riskFreeRate),
      18,
      { purpose: 'excess_return' }
    );

    if (volatility === 0) return 0;

    const sharpe = this.calculationLogger.divide(
      excessReturn,
      String(volatility),
      18,
      { purpose: 'sharpe_calculation' }
    );

    return Number(sharpe);
  }

  /**
   * Calculate Sortino ratio
   * Sortino = (Return - RiskFree) / Downside Volatility
   */
  private calculateSortinoRatio(
    roi: number,
    returns: number[],
    riskFreeRate: number,
    correlationId: string
  ): number {
    if (returns.length === 0) return 0;

    const roiDecimal = roi / 100;
    const excessReturn = this.calculationLogger.subtract(
      String(roiDecimal),
      String(riskFreeRate),
      18,
      { purpose: 'excess_return_sortino' }
    );

    // Downside volatility (only negative returns)
    const downside = returns.filter(r => r < 0);
    if (downside.length === 0) return Number(excessReturn) > 0 ? 999 : 0;

    const downsideVariance = downside.reduce((a, r) => a + Math.pow(r, 2), 0) / downside.length;
    const downsideVol = Math.sqrt(downsideVariance);

    if (downsideVol === 0) return 0;

    const sortino = this.calculationLogger.divide(
      excessReturn,
      String(downsideVol),
      18,
      { purpose: 'sortino_calculation' }
    );

    return Number(sortino);
  }

  /**
   * Calculate max drawdown
   */
  private calculateDrawdown(
    trades: Trade[],
    correlationId: string
  ): { maxDrawdown: number; currentDrawdown: number } {
    let peakCapital = 0;
    let maxDD = 0;
    let currentCapital = 0;

    for (const trade of trades) {
      currentCapital += Number(trade.profitEth);
      if (currentCapital > peakCapital) {
        peakCapital = currentCapital;
      }

      const dd = (peakCapital - currentCapital) / Math.max(peakCapital, 1);
      if (dd > maxDD) {
        maxDD = dd;
      }
    }

    const currentDD = (peakCapital - currentCapital) / Math.max(peakCapital, 1);

    return {
      maxDrawdown: maxDD,
      currentDrawdown: currentDD
    };
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `perf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
