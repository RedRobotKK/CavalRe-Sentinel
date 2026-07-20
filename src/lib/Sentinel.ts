/**
 * SENTINEL CORE
 *
 * Central orchestrator integrating all components.
 *
 * Provides:
 * - Unified interface for trading decisions
 * - Pipeline coordination (P1/P2/P3)
 * - State management
 * - Metrics and logging
 */

import { CalculationLogger, globalCalculationLogger } from './CalculationLogger';
import { StructuredLogger, globalStructuredLogger } from './StructuredLogger';
import { MetricsCollector, globalMetricsCollector } from './MetricsCollector';
import { CircuitBreakerManager, globalCircuitBreakerManager } from './CircuitBreaker';

import { RiskValidator, RiskConfig, DEFAULT_RISK_CONFIG } from './RiskValidator';
import { SignalAnalyzer, MarketSignals } from './SignalAnalyzer';
import { TradeDecisionEngine, PairHistory } from './TradeDecisionEngine';
import { TradeExecutor } from './TradeExecutor';
import { SignalCollector } from './SignalCollector';
import { ModelRetrainer } from './ModelRetrainer';
import { DriftDetector } from './DriftDetector';
import { PerformanceCalculator, Trade } from './PerformanceCalculator';

/**
 * Sentinel system state
 */
export interface SentinelState {
  readonly startTime: number;
  readonly status: 'initializing' | 'running' | 'paused' | 'error';
  readonly tradesExecuted: number;
  readonly totalProfit: string;
  readonly currentCapital: string;
  readonly modelVersion: number;
}

/**
 * Core Sentinel trading system
 *
 * Coordinates all components and provides unified interface.
 */
export class Sentinel {
  // Infrastructure layer
  private calculationLogger: CalculationLogger;
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;
  private circuitBreakerManager: CircuitBreakerManager;

  // Domain layer
  private riskValidator: RiskValidator;
  private signalAnalyzer: SignalAnalyzer;
  private tradeDecisionEngine: TradeDecisionEngine;
  private performanceCalculator: PerformanceCalculator;

  // Application layer
  private tradeExecutor: TradeExecutor;
  private signalCollector: SignalCollector;
  private modelRetrainer: ModelRetrainer;
  private driftDetector: DriftDetector;

  // State
  private state: SentinelState;
  private tradesHistory: Trade[] = [];

  constructor(config: Partial<RiskConfig> = {}) {
    // Initialize infrastructure
    this.calculationLogger = globalCalculationLogger;
    this.structuredLogger = globalStructuredLogger;
    this.metricsCollector = globalMetricsCollector;
    this.circuitBreakerManager = globalCircuitBreakerManager;

    // Initialize domain layer
    this.riskValidator = new RiskValidator(
      this.calculationLogger,
      this.structuredLogger,
      this.metricsCollector,
      config
    );

    this.signalAnalyzer = new SignalAnalyzer(
      this.calculationLogger,
      this.structuredLogger,
      this.metricsCollector
    );

    this.tradeDecisionEngine = new TradeDecisionEngine(
      this.calculationLogger,
      this.structuredLogger,
      this.metricsCollector,
      this.riskValidator,
      this.signalAnalyzer
    );

    this.performanceCalculator = new PerformanceCalculator(
      this.calculationLogger,
      this.structuredLogger,
      this.metricsCollector
    );

    // Initialize application layer
    this.tradeExecutor = new TradeExecutor(
      this.structuredLogger,
      this.metricsCollector,
      this.circuitBreakerManager,
      this.calculationLogger
    );

    this.signalCollector = new SignalCollector(
      this.structuredLogger,
      this.metricsCollector,
      this.circuitBreakerManager
    );

    this.modelRetrainer = new ModelRetrainer(
      this.structuredLogger,
      this.metricsCollector
    );

    this.driftDetector = new DriftDetector(
      this.structuredLogger,
      this.metricsCollector
    );

    // Initialize state
    this.state = {
      startTime: Date.now(),
      status: 'initializing',
      tradesExecuted: 0,
      totalProfit: '0',
      currentCapital: '10000', // Default $10k
      modelVersion: 1
    };

    this.metricsCollector.recordCapital(this.state.currentCapital);
    this.state.status = 'running';
  }

  /**
   * Execute complete trading decision
   *
   * Flow:
   * 1. Collect signals
   * 2. Analyze signals
   * 3. Make trade decision
   * 4. Execute trade (if approved)
   * 5. Record metrics
   */
  async executeTradingCycle(params: {
    pair: string;
    pairHistory: PairHistory;
    totalCapital: string | number;
    currentLeverage: string | number;
    dailyLoss: string | number;
    currentDrawdown: string | number;
    surplus: string | number;
    correlationId?: string;
  }): Promise<{
    decision: any;
    execution: any;
  }> {
    const correlationId = params.correlationId || this.generateCorrelationId();

    try {
      // Step 1: Collect signals
      const signals = await this.signalCollector.collectSignals(
        params.pair,
        correlationId
      );

      // Step 2: Make decision
      const decision = await this.tradeDecisionEngine.decide({
        pair: params.pair,
        pairHistory: params.pairHistory,
        signals: signals,
        context: {
          surplus: params.surplus,
          totalCapital: params.totalCapital,
          currentLeverage: params.currentLeverage,
          dailyLoss: params.dailyLoss,
          currentDrawdown: params.currentDrawdown
        },
        correlationId
      });

      // Step 3: Execute if approved
      let execution = null;
      if (decision.shouldExecute) {
        execution = await this.tradeExecutor.execute({
          decisionId: decision.id,
          pair: params.pair,
          expectedProfit: decision.expectedProfit,
          markup: decision.recommendedMarkup,
          correlationId
        });

        if (execution.status === 'confirmed') {
          this.state.tradesExecuted++;
          this.tradesHistory.push({
            id: execution.id,
            pair: params.pair,
            timestamp: Date.now(),
            profitEth: execution.actualProfit || decision.expectedProfit,
            markupApplied: decision.recommendedMarkup,
            confidence: decision.confidence
          });
        }
      }

      return { decision, execution };
    } catch (error) {
      this.state.status = 'error';
      this.metricsCollector.recordError();
      throw error;
    }
  }

  /**
   * Get current system state
   */
  getState(): SentinelState {
    return { ...this.state };
  }

  /**
   * Get performance metrics
   */
  async getPerformance(): Promise<any> {
    return this.performanceCalculator.calculate({
      startingCapital: '10000',
      currentCapital: this.state.currentCapital,
      trades: this.tradesHistory
    });
  }

  /**
   * Get metrics for dashboard
   */
  getMetrics(): any {
    return this.metricsCollector.export();
  }

  /**
   * Get audit log
   */
  getAuditLog(): any {
    return this.structuredLogger.export();
  }

  /**
   * Get calculation log
   */
  getCalculationLog(): any {
    return this.calculationLogger.export();
  }

  /**
   * Record model accuracy for drift detection
   */
  recordModelAccuracy(accuracy: number, correlationId?: string): void {
    const drift = this.driftDetector.recordAccuracy(accuracy, correlationId);

    if (drift.driftDetected) {
      this.structuredLogger.logError({
        errorType: 'ModelDriftDetected',
        errorMessage: `Model accuracy dropped ${(drift.driftPercent * 100).toFixed(2)}%`,
        context: {
          previousAccuracy: drift.previousAccuracy,
          currentAccuracy: drift.currentAccuracy,
          threshold: drift.threshold,
          recommendation: drift.recommendation
        },
        severity: 'high',
        correlationId
      });
    }

    this.metricsCollector.recordModelAccuracy(accuracy);
  }

  /**
   * Retrain model
   */
  async retrainModel(trainingData: any[], correlationId?: string): Promise<void> {
    const model = await this.modelRetrainer.retrain({
      trainingData,
      correlationId
    });

    if (model) {
      this.state.modelVersion = model.version;
      this.metricsCollector.recordModelAccuracy(model.metrics.accuracy);
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): any {
    return this.circuitBreakerManager.getAllStats();
  }

  /**
   * Get summary
   */
  getSummary(): string {
    const metrics = this.metricsCollector.export();
    const uptime = Date.now() - this.state.startTime;
    const uptimeStr = Math.floor(uptime / 1000 / 60) + 'min';

    return `
Sentinel Trading System
======================
Status: ${this.state.status}
Uptime: ${uptimeStr}
Trades: ${this.state.tradesExecuted}
Capital: ${this.state.currentCapital}
Model Version: ${this.state.modelVersion}

Metrics:
${this.metricsCollector.getSummary()}

Audit Trail: ${this.structuredLogger.getEventCount()} events
Calculations: ${this.calculationLogger.getTotalOperations()} operations
    `.trim();
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `sentinel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Global Sentinel instance
 */
export const globalSentinel = new Sentinel(DEFAULT_RISK_CONFIG);
