/**
 * Risk Engine Test Suite
 *
 * Position sizing and risk enforcement for CavalRe Sentinel
 * Tests verify:
 * - Position size calculations (Kelly, 5% capital rule)
 * - Risk limits (per-trade, daily, monthly)
 * - Stop-loss / take-profit enforcement
 * - Drawdown tracking and circuit breaker
 * - Leverage constraints (max 2.0x)
 *
 * Reference: https://github.com/CavalRe/cavalre-contracts/blob/main/modules/risk/RiskEngine.sol
 *
 * Capital Model:
 * - Starting: $1k USDC
 * - Max position: 5% of working capital
 * - Max leverage: 2.0x (flashloan)
 * - Max daily loss: 10% of working capital
 * - Max monthly loss: 20% of working capital
 * - Drawdown limit: 15% triggers review
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEngine, RiskConfig, Position, RiskMetrics } from '../src/risk-engine';
import * as FloatLib from '@cavalre/floatlib-ts';

describe('Risk Engine - Position Sizing & Enforcement', () => {

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const config: RiskConfig = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n), // $1k
        bufferPercent: FloatLib.toFloat(20n, 0n), // 20% buffer
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n), // $50k (5% of 1M capital)
        maxLeverage: FloatLib.toFloat(2n, 0n), // 2.0x max
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n), // $100k (10% of 1M)
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n), // $200k (20% of 1M)
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 = 15% max drawdown (fraction)
      };

      const engine = new RiskEngine(config);
      expect(FloatLib.toNumber(engine.getWorkingCapital())).toBeCloseTo(1000000, 2);
    });

    it('should calculate position buffer', () => {
      const config: RiskConfig = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      const engine = new RiskEngine(config);
      const buffer = engine.getAvailableCapital();
      // 1M - (20% * 1M) = 800k
      expect(FloatLib.toNumber(buffer)).toBeCloseTo(800000, 2);
    });
  });

  // ============================================================================
  // POSITION SIZING
  // ============================================================================

  describe('Position Sizing', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n), // $1M
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n), // $50k
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      engine = new RiskEngine(config);
    });

    it('should calculate base position from surplus', () => {
      const surplus = FloatLib.toFloat(5000000000n, 6n); // $5k surplus
      // Position = min(5% capital, 10x surplus, max position)
      // = min(50k, 50k, 50k) = 50k
      const position = engine.calculatePositionSize(surplus);
      expect(FloatLib.toNumber(position)).toBeCloseTo(50000, 2);
    });

    it('should cap position at 5% of capital', () => {
      const smallSurplus = FloatLib.toFloat(1000000000000n, 6n); // $1M surplus (huge)
      // Position = min(5% capital, 10x surplus, max position)
      // = min(50k, 10M, 50k) = 50k
      const position = engine.calculatePositionSize(smallSurplus);
      expect(FloatLib.toNumber(position)).toBeCloseTo(50000, 2);
    });

    it('should scale with 10x leverage on surplus', () => {
      const surplus = FloatLib.toFloat(1000000000n, 6n); // $1k surplus
      // Position = min(5% capital=50k, 10x surplus=10k, max position=50k)
      // = 10k
      const position = engine.calculatePositionSize(surplus);
      expect(FloatLib.toNumber(position)).toBeCloseTo(10000, 2);
    });

    it('should return zero for zero surplus', () => {
      const surplus = FloatLib.ZERO;
      const position = engine.calculatePositionSize(surplus);
      expect(FloatLib.isZero(position)).toBe(true);
    });
  });

  // ============================================================================
  // LEVERAGE ENFORCEMENT
  // ============================================================================

  describe('Leverage Constraints', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n), // 2.0x
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      engine = new RiskEngine(config);
    });

    it('should enforce max leverage', () => {
      const position = FloatLib.toFloat(500000000000n, 6n); // $500k position
      const equity = FloatLib.toFloat(1000000000000n, 6n); // $1M equity
      // Leverage = 500k / 1M = 0.5x ✓ (< 2.0x)
      const isAllowed = engine.checkLeverage(position, equity);
      expect(isAllowed).toBe(true);
    });

    it('should reject excessive leverage', () => {
      const position = FloatLib.toFloat(2500000000000n, 6n); // $2.5M position
      const equity = FloatLib.toFloat(1000000000000n, 6n); // $1M equity
      // Leverage = 2.5M / 1M = 2.5x ✗ (> 2.0x)
      const isAllowed = engine.checkLeverage(position, equity);
      expect(isAllowed).toBe(false);
    });

    it('should allow exactly max leverage', () => {
      const position = FloatLib.toFloat(2000000000000n, 6n); // $2M position
      const equity = FloatLib.toFloat(1000000000000n, 6n); // $1M equity
      // Leverage = 2M / 1M = 2.0x ✓ (exactly at limit)
      const isAllowed = engine.checkLeverage(position, equity);
      expect(isAllowed).toBe(true);
    });
  });

  // ============================================================================
  // LOSS LIMITS
  // ============================================================================

  describe('Loss Limits', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n), // $100k
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n), // $200k
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      engine = new RiskEngine(config);
    });

    it('should allow trade within daily loss limit', () => {
      const dailyLoss = FloatLib.toFloat(50000000000n, 6n); // $50k loss
      const isAllowed = engine.checkDailyLoss(dailyLoss);
      expect(isAllowed).toBe(true);
    });

    it('should reject trade exceeding daily loss limit', () => {
      const dailyLoss = FloatLib.toFloat(150000000000n, 6n); // $150k loss (> $100k limit)
      const isAllowed = engine.checkDailyLoss(dailyLoss);
      expect(isAllowed).toBe(false);
    });

    it('should allow trade within monthly loss limit', () => {
      const monthlyLoss = FloatLib.toFloat(150000000000n, 6n); // $150k loss
      const isAllowed = engine.checkMonthlyLoss(monthlyLoss);
      expect(isAllowed).toBe(true);
    });

    it('should reject trade exceeding monthly loss limit', () => {
      const monthlyLoss = FloatLib.toFloat(250000000000n, 6n); // $250k loss (> $200k limit)
      const isAllowed = engine.checkMonthlyLoss(monthlyLoss);
      expect(isAllowed).toBe(false);
    });
  });

  // ============================================================================
  // DRAWDOWN TRACKING
  // ============================================================================

  describe('Drawdown Tracking', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction // 15%
      };

      engine = new RiskEngine(config);
    });

    it('should calculate peak equity', () => {
      const equity1 = FloatLib.toFloat(1000000000000n, 6n);
      engine.updateEquity(equity1);

      const equity2 = FloatLib.toFloat(900000000000n, 6n);
      engine.updateEquity(equity2);

      const peak = engine.getPeakEquity();
      expect(FloatLib.toNumber(peak)).toBeCloseTo(1000000, 2);
    });

    it('should calculate current drawdown', () => {
      const equity1 = FloatLib.toFloat(1000000000000n, 6n);
      engine.updateEquity(equity1);

      const equity2 = FloatLib.toFloat(850000000000n, 6n); // 15% loss
      engine.updateEquity(equity2);

      const drawdown = engine.getCurrentDrawdown();
      // DD = (1M - 850k) / 1M = 0.15 = 15%
      expect(FloatLib.toNumber(drawdown)).toBeCloseTo(0.15, 4);
    });

    it('should alert when drawdown exceeds limit', () => {
      const equity1 = FloatLib.toFloat(1000000000000n, 6n);
      engine.updateEquity(equity1);

      const equity2 = FloatLib.toFloat(840000000000n, 6n); // 16% loss (> 15% limit)
      engine.updateEquity(equity2);

      const exceeded = engine.isDrawdownExceeded();
      expect(exceeded).toBe(true);
    });
  });

  // ============================================================================
  // RISK METRICS
  // ============================================================================

  describe('Risk Metrics', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      engine = new RiskEngine(config);
    });

    it('should calculate risk-reward ratio', () => {
      const entryPrice = FloatLib.toFloat(100n, 0n); // $100
      const stopLoss = FloatLib.toFloat(95n, 0n); // $95 (5% risk)
      const takeProfit = FloatLib.toFloat(110n, 0n); // $110 (10% reward)

      const ratio = engine.calculateRiskReward(entryPrice, stopLoss, takeProfit);
      // RR = (110-100) / (100-95) = 10 / 5 = 2.0
      expect(FloatLib.toNumber(ratio)).toBeCloseTo(2.0, 4);
    });

    it('should calculate Kelly position size', () => {
      const winRate = FloatLib.toFloat(55n, 2n); // 0.55 = 55% win rate
      const avgWin = FloatLib.toFloat(150n, 0n); // $150
      const avgLoss = FloatLib.toFloat(100n, 0n); // $100

      // Kelly = (winRate * avgWin - (1-winRate) * avgLoss) / avgWin
      // = (0.55 * 150 - 0.45 * 100) / 150
      // = (82.5 - 45) / 150 = 37.5 / 150 = 0.25 = 25%
      const kelly = engine.calculateKellySize(winRate, avgWin, avgLoss);
      expect(FloatLib.toNumber(kelly)).toBeCloseTo(0.25, 4);
    });

    it('should provide comprehensive metrics', () => {
      engine.updateEquity(FloatLib.toFloat(1000000000000n, 6n));
      engine.recordTrade({
        pnl: FloatLib.toFloat(50000000000n, 6n),
        timestamp: 1000000n,
        symbol: 'USDC/ETH',
      });

      const metrics = engine.getMetrics();
      expect(metrics.workingCapital).toBeDefined();
      expect(metrics.peakEquity).toBeDefined();
      expect(metrics.currentDrawdown).toBeDefined();
      expect(metrics.totalTrades).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // STOP-LOSS / TAKE-PROFIT
  // ============================================================================

  describe('Stop-Loss & Take-Profit', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      engine = new RiskEngine(config);
    });

    it('should trigger stop-loss on downside', () => {
      const entryPrice = FloatLib.toFloat(100n, 0n);
      const stopLoss = FloatLib.toFloat(95n, 0n);
      const currentPrice = FloatLib.toFloat(94n, 0n); // Below SL

      const shouldStop = engine.checkStopLoss(entryPrice, stopLoss, currentPrice);
      expect(shouldStop).toBe(true);
    });

    it('should trigger take-profit on upside', () => {
      const entryPrice = FloatLib.toFloat(100n, 0n);
      const takeProfit = FloatLib.toFloat(110n, 0n);
      const currentPrice = FloatLib.toFloat(111n, 0n); // Above TP

      const shouldTakeProfit = engine.checkTakeProfit(entryPrice, takeProfit, currentPrice);
      expect(shouldTakeProfit).toBe(true);
    });

    it('should not exit if price between SL and TP', () => {
      const entryPrice = FloatLib.toFloat(100n, 0n);
      const stopLoss = FloatLib.toFloat(95n, 0n);
      const takeProfit = FloatLib.toFloat(110n, 0n);
      const currentPrice = FloatLib.toFloat(102n, 0n); // Mid-range

      const shouldStop = engine.checkStopLoss(entryPrice, stopLoss, currentPrice);
      const shouldProfit = engine.checkTakeProfit(entryPrice, takeProfit, currentPrice);

      expect(shouldStop).toBe(false);
      expect(shouldProfit).toBe(false);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    let engine: RiskEngine;
    let config: RiskConfig;

    beforeEach(() => {
      config = {
        workingCapital: FloatLib.toFloat(1000000000000n, 6n),
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.toFloat(50000000000n, 6n),
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.toFloat(100000000000n, 6n),
        maxMonthlyLoss: FloatLib.toFloat(200000000000n, 6n),
        drawdownLimit: FloatLib.toFloat(15n, 2n), // 0.15 fraction
      };

      engine = new RiskEngine(config);
    });

    it('should handle zero capital', () => {
      const zeroConfig: RiskConfig = {
        workingCapital: FloatLib.ZERO,
        bufferPercent: FloatLib.toFloat(20n, 0n),
        maxPositionSize: FloatLib.ZERO,
        maxLeverage: FloatLib.toFloat(2n, 0n),
        maxDailyLoss: FloatLib.ZERO,
        maxMonthlyLoss: FloatLib.ZERO,
        drawdownLimit: FloatLib.ZERO,
      };

      const zeroEngine = new RiskEngine(zeroConfig);
      expect(FloatLib.isZero(zeroEngine.getWorkingCapital())).toBe(true);
    });

    it('should handle 100% loss (drawdown = 1.0)', () => {
      engine.updateEquity(FloatLib.toFloat(1000000000000n, 6n));
      engine.updateEquity(FloatLib.ZERO);

      const drawdown = engine.getCurrentDrawdown();
      expect(FloatLib.toNumber(drawdown)).toBeCloseTo(1.0, 4);
    });
  });
});
