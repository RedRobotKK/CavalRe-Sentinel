/**
 * DRIFT DETECTOR
 *
 * Monitors model accuracy and detects degradation.
 *
 * When accuracy drops > 10%, triggers alert and retraining.
 */

import { StructuredLogger } from './StructuredLogger';
import { MetricsCollector } from './MetricsCollector';

export interface DriftEvent {
  timestamp: number;
  previousAccuracy: number;
  currentAccuracy: number;
  driftPercent: number;
  threshold: number;
  driftDetected: boolean;
  recommendation: string;
}

/**
 * Detects model drift (accuracy degradation)
 */
export class DriftDetector {
  private structuredLogger: StructuredLogger;
  private metricsCollector: MetricsCollector;
  private accuracyHistory: number[] = [];
  private readonly DRIFT_THRESHOLD = 0.10; // 10% drop
  private readonly WINDOW_SIZE = 10; // Check last 10 measurements

  constructor(
    structuredLogger: StructuredLogger,
    metricsCollector: MetricsCollector
  ) {
    this.structuredLogger = structuredLogger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Record accuracy measurement
   */
  recordAccuracy(accuracy: number, correlationId?: string): DriftEvent {
    const id = correlationId || this.generateCorrelationId();

    this.accuracyHistory.push(accuracy);
    if (this.accuracyHistory.length > this.WINDOW_SIZE) {
      this.accuracyHistory.shift();
    }

    const driftEvent = this.detectDrift(id);
    return driftEvent;
  }

  /**
   * Detect drift by comparing current accuracy to recent history
   */
  private detectDrift(correlationId: string): DriftEvent {
    const event: DriftEvent = {
      timestamp: Date.now(),
      previousAccuracy: 0,
      currentAccuracy: 0,
      driftPercent: 0,
      threshold: this.DRIFT_THRESHOLD,
      driftDetected: false,
      recommendation: 'Continue monitoring'
    };

    if (this.accuracyHistory.length < 2) {
      return event;
    }

    const current = this.accuracyHistory[this.accuracyHistory.length - 1];
    const previous = this.accuracyHistory[0];
    const drift = previous - current;
    const driftPercent = drift / previous;

    event.previousAccuracy = previous;
    event.currentAccuracy = current;
    event.driftPercent = driftPercent;
    event.driftDetected = driftPercent > this.DRIFT_THRESHOLD;

    if (event.driftDetected) {
      event.recommendation = 'URGENT: Retrain model immediately';

      this.structuredLogger.logDriftDetection({
        previousAccuracy: previous,
        currentAccuracy: current,
        driftPercent: driftPercent,
        threshold: this.DRIFT_THRESHOLD,
        driftDetected: true,
        correlationId
      });

      this.metricsCollector.recordError();
    } else {
      event.recommendation = 'Continue monitoring - no drift detected';
    }

    return event;
  }

  /**
   * Get drift history
   */
  getAccuracyHistory(): number[] {
    return [...this.accuracyHistory];
  }

  /**
   * Reset drift detector
   */
  reset(): void {
    this.accuracyHistory = [];
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `drift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
