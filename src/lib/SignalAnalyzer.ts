/**
 * SIGNAL ANALYZER
 *
 * Analyzes market signals to determine confidence in trading decisions.
 *
 * Signals Tracked:
 * - DEX Volume (24h volume across major DEXes)
 * - Volatility (price standard deviation)
 * - Open Interest (derivatives market engagement)
 * - Stablecoin Supply Trend (market regime indicator)
 *
 * Produces: Signal score (0-100), regime detection, confidence level
 * All calculations use CalculationLogger for audit trail.
 */

import { CalculationLogger } from './CalculationLogger';
import { StructuredLogger } from './StructuredLogger';
import { MetricsCollector } from './MetricsCollector';

/**
 * Market signals input
 */
export interface MarketSignals {
  dexVolume24h: string | number; // USD
  volatility: string | number; // 0-100, std dev
  openInterest: string | number; // USD
  stablecoinTrend: 'risk-on' | 'risk-off' | 'neutral'; // Supply direction
  wethPrice: string | number; // Current price
}

/**
 * Market regime
 */
export type MarketRegime = 'bullish' | 'neutral' | 'bearish';

/**
 * Signal analysis result
 */
export interface SignalAnalysis {
  timestamp: number;
  regime: MarketRegime;
  volumeScore: number; // 0-100
  volatilityScore: number; // 0-100
  oiScore: number; // 0-100
  stablecoinScore: number; // 0-100
  compositeScore: number; // 0-100
  confidence: number; // 0-1
  recommendation: 'aggressive' | 'moderate' | 'conservative';
}

/**
 * Analyzes market signals and produces trading confidence score
 */
export class SignalAnalyzer {
  private calculationLogger: CalculationLogger;
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;

  // Signal thresholds
  private readonly VOLUME_BASELINE_USD = 5e9; // $5B baseline
  private readonly VOLATILITY_MODERATE_MIN = 40; // Moderate volatility
  private readonly VOLATILITY_MODERATE_MAX = 70;
  private readonly OI_HEALTHY_MIN = 2e9; // $2B+ healthy
  private readonly CONFIDENCE_THRESHOLD = 0.65; // Min confidence to trade

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
   * Analyze market signals and produce trading confidence
   */
  analyze(signals: MarketSignals, correlationId?: string): SignalAnalysis {
    const timestamp = Date.now();
    const id = correlationId || `signal-${timestamp}-${Math.random().toString(36).slice(2, 9)}`;

    // Analyze each signal
    const volumeScore = this.analyzeVolume(Number(signals.dexVolume24h), id);
    const volatilityScore = this.analyzeVolatility(Number(signals.volatility), id);
    const oiScore = this.analyzeOpenInterest(Number(signals.openInterest), id);
    const stablecoinScore = this.analyzeStablecoinTrend(signals.stablecoinTrend, id);

    // Composite score (weighted average)
    const compositeScore = this.calculateComposite(
      volumeScore,
      volatilityScore,
      oiScore,
      stablecoinScore,
      id
    );

    // Confidence (0-1)
    const confidence = compositeScore / 100;

    // Regime detection
    const regime = this.detectRegime(
      signals.stablecoinTrend,
      volatilityScore,
      oiScore
    );

    // Recommendation based on regime
    const recommendation = this.makeRecommendation(regime, confidence);

    const analysis: SignalAnalysis = {
      timestamp,
      regime,
      volumeScore,
      volatilityScore,
      oiScore,
      stablecoinScore,
      compositeScore,
      confidence,
      recommendation
    };

    // Log signal analysis
    this.structuredLogger.logSignalAnalysis({
      signals: {
        volume: signals.dexVolume24h,
        volatility: signals.volatility,
        openInterest: signals.openInterest,
        stablecoinTrend: signals.stablecoinTrend
      },
      score: compositeScore,
      regimeDetected: regime,
      confidence: confidence,
      correlationId: id
    });

    return analysis;
  }

  /**
   * Analyze DEX volume
   * Higher volume = more liquidity = lower slippage = better execution
   *
   * Scoring:
   * 0: $0 volume
   * 50: $5B (baseline)
   * 100: $10B+
   */
  private analyzeVolume(volumeUsd: number, correlationId: string): number {
    const baselineUsd = this.VOLUME_BASELINE_USD;

    // Calculate ratio to baseline
    const ratio = this.calculationLogger.divide(
      volumeUsd,
      baselineUsd,
      18,
      { purpose: 'volume_baseline_ratio' }
    );

    // Convert to score (0-100, capped)
    const scoreStr = this.calculationLogger.multiply(
      ratio,
      '100',
      18,
      { purpose: 'volume_to_score' }
    );

    let score = Number(scoreStr);
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    return Math.round(score);
  }

  /**
   * Analyze volatility
   * Moderate volatility (40-70) = best for trading
   * Too low (0-40) = less opportunity
   * Too high (70-100) = risky execution
   *
   * Scoring:
   * 0: 0% or 100% volatility
   * 100: 40-70% volatility
   * 50: 0% or 100% volatility
   */
  private analyzeVolatility(volatility: number, correlationId: string): number {
    // Ideal range is 40-70
    const min = this.VOLATILITY_MODERATE_MIN;
    const max = this.VOLATILITY_MODERATE_MAX;
    const range = max - min;

    if (volatility >= min && volatility <= max) {
      // In ideal range = 100
      return 100;
    }

    if (volatility < min) {
      // Below ideal: score = volatility / min
      const ratio = volatility / min;
      return Math.round(ratio * 100);
    }

    // Above ideal: score = (100 - volatility) / (100 - max)
    const ratio = (100 - volatility) / (100 - max);
    return Math.round(Math.max(ratio * 100, 0));
  }

  /**
   * Analyze open interest
   * High OI = more derivatives trading = more edge opportunities
   *
   * Scoring:
   * 0: $0 OI
   * 50: $2B (baseline)
   * 100: $5B+
   */
  private analyzeOpenInterest(oiUsd: number, correlationId: string): number {
    const baselineUsd = this.OI_HEALTHY_MIN;

    // Calculate ratio to baseline
    const ratio = this.calculationLogger.divide(
      oiUsd,
      baselineUsd,
      18,
      { purpose: 'oi_baseline_ratio' }
    );

    // Convert to score (0-100, capped)
    const scoreStr = this.calculationLogger.multiply(
      ratio,
      '100',
      18,
      { purpose: 'oi_to_score' }
    );

    let score = Number(scoreStr);
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    return Math.round(score);
  }

  /**
   * Analyze stablecoin supply trend
   * Rising supply = risk-on sentiment (bullish) = 100
   * Falling supply = risk-off sentiment (bearish) = 0
   * Neutral = 50
   */
  private analyzeStablecoinTrend(
    trend: 'risk-on' | 'risk-off' | 'neutral',
    correlationId: string
  ): number {
    switch (trend) {
      case 'risk-on':
        return 100;
      case 'risk-off':
        return 0;
      case 'neutral':
        return 50;
    }
  }

  /**
   * Calculate composite score from all signals
   * Weighted average: volume 25%, volatility 25%, OI 25%, stablecoin 25%
   */
  private calculateComposite(
    volumeScore: number,
    volatilityScore: number,
    oiScore: number,
    stablecoinScore: number,
    correlationId: string
  ): number {
    const weight = 0.25;

    // Calculate each weighted component
    const volumeWeighted = this.calculationLogger.multiply(
      String(volumeScore),
      String(weight),
      18,
      { purpose: 'volume_weighted' }
    );

    const volatilityWeighted = this.calculationLogger.multiply(
      String(volatilityScore),
      String(weight),
      18,
      { purpose: 'volatility_weighted' }
    );

    const oiWeighted = this.calculationLogger.multiply(
      String(oiScore),
      String(weight),
      18,
      { purpose: 'oi_weighted' }
    );

    const stablecoinWeighted = this.calculationLogger.multiply(
      String(stablecoinScore),
      String(weight),
      18,
      { purpose: 'stablecoin_weighted' }
    );

    // Sum all weighted components
    const sum1 = this.calculationLogger.add(
      volumeWeighted,
      volatilityWeighted,
      18,
      { purpose: 'composite_add_1' }
    );

    const sum2 = this.calculationLogger.add(
      sum1,
      oiWeighted,
      18,
      { purpose: 'composite_add_2' }
    );

    const composite = this.calculationLogger.add(
      sum2,
      stablecoinWeighted,
      18,
      { purpose: 'composite_add_3' }
    );

    return Math.round(Number(composite));
  }

  /**
   * Detect market regime from signals
   */
  private detectRegime(
    stablecoinTrend: 'risk-on' | 'risk-off' | 'neutral',
    volatilityScore: number,
    oiScore: number
  ): MarketRegime {
    if (stablecoinTrend === 'risk-on') {
      // Risk-on + high volatility/OI = strong bullish
      if (volatilityScore > 60 || oiScore > 60) {
        return 'bullish';
      }
      return 'neutral';
    }

    if (stablecoinTrend === 'risk-off') {
      // Risk-off = bearish
      return 'bearish';
    }

    // Neutral stablecoin trend
    if (volatilityScore < 40 && oiScore < 40) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * Make trading recommendation based on regime and confidence
   */
  private makeRecommendation(
    regime: MarketRegime,
    confidence: number
  ): 'aggressive' | 'moderate' | 'conservative' {
    if (regime === 'bullish' && confidence > 0.8) {
      return 'aggressive';
    }

    if (regime === 'bearish' || confidence < 0.5) {
      return 'conservative';
    }

    return 'moderate';
  }
}
