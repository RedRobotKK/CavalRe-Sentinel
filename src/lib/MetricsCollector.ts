/**
 * METRICS COLLECTOR
 *
 * Prometheus-format metrics collection.
 * Tracks all system health indicators:
 * - Trade execution counts and profits
 * - Model accuracy and performance
 * - Risk checks and violations
 * - Calculation performance
 * - External service health
 *
 * Usage:
 *   const collector = new MetricsCollector();
 *   collector.recordTrade(execution);
 *   collector.recordModelAccuracy(0.95);
 *   const metrics = collector.export();
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface Metric {
  readonly name: string;
  readonly type: MetricType;
  readonly help: string;
  readonly value: number;
  readonly timestamp: number;
  readonly labels?: Record<string, string>;
}

export interface PrometheusMetrics {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
}

/**
 * Collects and stores metrics
 * Can export in Prometheus format
 */
export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private metrics: Metric[] = [];

  constructor() {
    this.initializeMetrics();
  }

  /**
   * Initialize standard metrics
   */
  private initializeMetrics(): void {
    // Counters: always increasing
    this.counters.set('sentinel_trades_executed_total', 0);
    this.counters.set('sentinel_trades_failed_total', 0);
    this.counters.set('sentinel_risk_checks_total', 0);
    this.counters.set('sentinel_risk_violations_total', 0);
    this.counters.set('sentinel_calculations_total', 0);
    this.counters.set('sentinel_errors_total', 0);
    this.counters.set('sentinel_models_retrained_total', 0);

    // Gauges: can go up or down
    this.gauges.set('sentinel_model_accuracy', 0);
    this.gauges.set('sentinel_model_precision', 0);
    this.gauges.set('sentinel_model_recall', 0);
    this.gauges.set('sentinel_model_f1_score', 0);
    this.gauges.set('sentinel_capital_current', 0);
    this.gauges.set('sentinel_capital_starting', 10000);
    this.gauges.set('sentinel_roi_percent', 0);
    this.gauges.set('sentinel_win_rate_percent', 0);
    this.gauges.set('sentinel_sharpe_ratio', 0);
    this.gauges.set('sentinel_max_drawdown_percent', 0);
    this.gauges.set('sentinel_circuit_breaker_open', 0);
    this.gauges.set('sentinel_pipeline_healthy', 1);

    // Histograms: track distributions
    this.histograms.set('sentinel_trade_profit_eth', []);
    this.histograms.set('sentinel_trade_loss_eth', []);
    this.histograms.set('sentinel_calculation_duration_ms', []);
    this.histograms.set('sentinel_model_retraining_duration_ms', []);
  }

  // ========================================================================
  // COUNTER OPERATIONS (increment only)
  // ========================================================================

  /**
   * Increment counter
   */
  incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  /**
   * Record successful trade
   */
  recordTradeSuccess(): void {
    this.incrementCounter('sentinel_trades_executed_total');
  }

  /**
   * Record failed trade
   */
  recordTradeFailure(): void {
    this.incrementCounter('sentinel_trades_failed_total');
  }

  /**
   * Record risk check
   */
  recordRiskCheck(): void {
    this.incrementCounter('sentinel_risk_checks_total');
  }

  /**
   * Record risk violation
   */
  recordRiskViolation(): void {
    this.incrementCounter('sentinel_risk_violations_total');
  }

  /**
   * Record calculation
   */
  recordCalculation(): void {
    this.incrementCounter('sentinel_calculations_total');
  }

  /**
   * Record error
   */
  recordError(): void {
    this.incrementCounter('sentinel_errors_total');
  }

  /**
   * Record model retrain
   */
  recordModelRetrain(): void {
    this.incrementCounter('sentinel_models_retrained_total');
  }

  // ========================================================================
  // GAUGE OPERATIONS (set to value)
  // ========================================================================

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record model accuracy
   */
  recordModelAccuracy(accuracy: number): void {
    this.setGauge('sentinel_model_accuracy', accuracy);
  }

  /**
   * Record model precision
   */
  recordModelPrecision(precision: number): void {
    this.setGauge('sentinel_model_precision', precision);
  }

  /**
   * Record model recall
   */
  recordModelRecall(recall: number): void {
    this.setGauge('sentinel_model_recall', recall);
  }

  /**
   * Record model F1 score
   */
  recordModelF1Score(f1: number): void {
    this.setGauge('sentinel_model_f1_score', f1);
  }

  /**
   * Record current capital
   */
  recordCapital(amount: string | number): void {
    this.setGauge('sentinel_capital_current', Number(amount));
  }

  /**
   * Record ROI
   */
  recordROI(roi: number): void {
    this.setGauge('sentinel_roi_percent', roi);
  }

  /**
   * Record win rate
   */
  recordWinRate(rate: number): void {
    this.setGauge('sentinel_win_rate_percent', rate * 100);
  }

  /**
   * Record Sharpe ratio
   */
  recordSharpeRatio(ratio: number): void {
    this.setGauge('sentinel_sharpe_ratio', ratio);
  }

  /**
   * Record max drawdown
   */
  recordMaxDrawdown(drawdown: number): void {
    this.setGauge('sentinel_max_drawdown_percent', drawdown * 100);
  }

  /**
   * Record circuit breaker status
   */
  recordCircuitBreakerStatus(isOpen: boolean): void {
    this.setGauge('sentinel_circuit_breaker_open', isOpen ? 1 : 0);
  }

  /**
   * Record pipeline health
   */
  recordPipelineHealth(healthy: boolean): void {
    this.setGauge('sentinel_pipeline_healthy', healthy ? 1 : 0);
  }

  // ========================================================================
  // HISTOGRAM OPERATIONS (track distribution)
  // ========================================================================

  /**
   * Add value to histogram
   */
  recordHistogramValue(name: string, value: number): void {
    const values = this.histograms.get(name) ?? [];
    values.push(value);
    this.histograms.set(name, values);
  }

  /**
   * Record trade profit
   */
  recordTradeProfit(profitEth: string | number): void {
    this.recordHistogramValue('sentinel_trade_profit_eth', Number(profitEth));
  }

  /**
   * Record trade loss
   */
  recordTradeLoss(lossEth: string | number): void {
    this.recordHistogramValue('sentinel_trade_loss_eth', Math.abs(Number(lossEth)));
  }

  /**
   * Record calculation duration
   */
  recordCalculationDuration(duration_ms: number): void {
    this.recordHistogramValue('sentinel_calculation_duration_ms', duration_ms);
  }

  /**
   * Record model retraining duration
   */
  recordRetrainingDuration(duration_ms: number): void {
    this.recordHistogramValue('sentinel_model_retraining_duration_ms', duration_ms);
  }

  // ========================================================================
  // QUERIES
  // ========================================================================

  /**
   * Get counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  /**
   * Get histogram values
   */
  getHistogram(name: string): number[] {
    return [...(this.histograms.get(name) ?? [])];
  }

  /**
   * Calculate histogram statistics
   */
  getHistogramStats(name: string) {
    const values = this.histograms.get(name) ?? [];
    if (values.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Get all metrics as Prometheus format
   */
  export(): PrometheusMetrics {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms)
    };
  }

  /**
   * Export as Prometheus text format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, value] of this.counters) {
      lines.push(`# HELP ${name} Total count`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Gauges
    for (const [name, value] of this.gauges) {
      lines.push(`# HELP ${name} Current gauge value`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Histograms
    for (const [name, values] of this.histograms) {
      const stats = this.getHistogramStats(name);
      lines.push(`# HELP ${name} Histogram distribution`);
      lines.push(`# TYPE ${name} histogram`);
      lines.push(`${name}_count ${stats.count}`);
      lines.push(`${name}_min ${stats.min}`);
      lines.push(`${name}_max ${stats.max}`);
      lines.push(`${name}_avg ${stats.avg.toFixed(2)}`);
      lines.push(`${name}_p95 ${stats.p95}`);
    }

    return lines.join('\n');
  }

  /**
   * Export as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * Get summary
   */
  getSummary(): string {
    const trades = this.getCounter('sentinel_trades_executed_total');
    const accuracy = this.getGauge('sentinel_model_accuracy');
    const roi = this.getGauge('sentinel_roi_percent');
    const capital = this.getGauge('sentinel_capital_current');

    return `Trades: ${trades} | Accuracy: ${accuracy.toFixed(1)}% | ROI: ${roi.toFixed(1)}% | Capital: ${capital.toFixed(0)}`;
  }

  /**
   * Reset all metrics
   * Only for testing
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.metrics = [];
    this.initializeMetrics();
  }
}

/**
 * Global metrics collector instance
 */
export const globalMetricsCollector = new MetricsCollector();
