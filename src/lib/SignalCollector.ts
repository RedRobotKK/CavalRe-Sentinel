/**
 * SIGNAL COLLECTOR
 *
 * Fetches market signals from external sources.
 *
 * Sources:
 * - DefiLlama (DEX volume, stablecoin supply)
 * - Mock data (for development)
 *
 * All fetches are protected by circuit breaker.
 */

import { StructuredLogger } from './StructuredLogger';
import { MetricsCollector } from './MetricsCollector';
import { CircuitBreakerManager } from './CircuitBreaker';
import { MarketSignals } from './SignalAnalyzer';

export interface SignalCacheEntry {
  signals: MarketSignals;
  timestamp: number;
  ttl_ms: number;
}

/**
 * Collects market signals from external sources
 */
export class SignalCollector {
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;
  private circuitBreakerManager: CircuitBreakerManager;
  private signalCache: Map<string, SignalCacheEntry> = new Map();

  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(
    structuredLogger: StructuredLogger,
    metricsCollector: MetricsCollector,
    circuitBreakerManager: CircuitBreakerManager
  ) {
    this.structuredLogger = structuredLogger;
    this.metricsCollector = metricsCollector;
    this.circuitBreakerManager = circuitBreakerManager;
  }

  /**
   * Collect signals for a pair
   */
  async collectSignals(
    pair: string,
    correlationId?: string
  ): Promise<MarketSignals> {
    const id = correlationId || this.generateCorrelationId();

    // Check cache
    const cached = this.signalCache.get(pair);
    if (cached && Date.now() - cached.timestamp < cached.ttl_ms) {
      return cached.signals;
    }

    // Fetch fresh signals
    const signals = await this.circuitBreakerManager.execute(
      'defi-llama',
      () => this.fetchSignals(pair),
      { failureThreshold: 3, timeout: 10000 }
    );

    // Cache result
    this.signalCache.set(pair, {
      signals,
      timestamp: Date.now(),
      ttl_ms: this.CACHE_TTL_MS
    });

    this.structuredLogger.logSignalAnalysis({
      signals: signals,
      score: 0,
      regimeDetected: 'neutral',
      confidence: 0.5,
      correlationId: id
    });

    return signals;
  }

  /**
   * Fetch signals from DefiLlama (or mock)
   */
  private async fetchSignals(pair: string): Promise<MarketSignals> {
    // Mock implementation - in production would call DefiLlama API
    return {
      dexVolume24h: 5.2e9, // $5.2B
      volatility: 60,
      openInterest: 5e9, // $5B
      stablecoinTrend: 'risk-on',
      wethPrice: 2500.32
    };
  }

  /**
   * Clear signal cache
   */
  clearCache(): void {
    this.signalCache.clear();
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `signals-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
