/**
 * STRUCTURED LOGGER
 *
 * Immutable, JSON-based event logging system.
 * Every decision, risk check, and calculation is logged as an event.
 *
 * Events are:
 * - Immutable (append-only event store)
 * - Queryable (filter, search by time/type)
 * - Auditable (full decision history)
 * - Traceable (correlation IDs across operations)
 *
 * Usage:
 *   const logger = new StructuredLogger();
 *   logger.logTradeDecision({...});
 *   logger.logRiskCheck({...});
 *   const events = logger.getEventsByType('TradeDecision');
 */

export type EventType =
  | 'TradeDecisionMade'
  | 'TradeExecuted'
  | 'TradeFailure'
  | 'RiskCheckExecuted'
  | 'RiskCheckFailed'
  | 'CalculationPerformed'
  | 'SignalAnalyzed'
  | 'ModelRetrained'
  | 'DriftDetected'
  | 'SystemHealthCheck'
  | 'PipelineStatus'
  | 'CircuitBreakerTriggered'
  | 'ErrorOccurred';

export interface LogEvent {
  readonly eventId: string;
  readonly eventType: EventType;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly data: Record<string, any>;
  readonly user?: string;
  readonly environment: string;
}

export interface EventFilter {
  eventType?: EventType;
  startTime?: number;
  endTime?: number;
  correlationId?: string;
  limit?: number;
}

export interface EventStats {
  totalEvents: number;
  byType: Record<EventType, number>;
  timeRange: {
    earliest: number;
    latest: number;
    duration_ms: number;
  };
}

/**
 * Append-only event logger
 * All events are immutable once logged
 */
export class StructuredLogger {
  private events: LogEvent[] = [];
  private sessionId: string;
  private correlationStack: string[] = [];
  private startTime: number;

  constructor() {
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.startTime = Date.now();
  }

  /**
   * Get or create correlation ID
   * Used to trace related operations
   */
  getCurrentCorrelationId(): string {
    if (this.correlationStack.length === 0) {
      const id = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      this.correlationStack.push(id);
      return id;
    }
    return this.correlationStack[this.correlationStack.length - 1];
  }

  /**
   * Push new correlation context
   * Use when starting a nested operation
   */
  pushCorrelation(id?: string): string {
    const newId = id || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.correlationStack.push(newId);
    return newId;
  }

  /**
   * Pop correlation context
   * Use when exiting a nested operation
   */
  popCorrelation(): string | undefined {
    return this.correlationStack.pop();
  }

  /**
   * Core logging method
   * All other methods use this
   */
  private log(
    eventType: EventType,
    data: Record<string, any>,
    correlationId?: string
  ): LogEvent {
    const event: LogEvent = {
      eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      eventType,
      timestamp: Date.now(),
      correlationId: correlationId || this.getCurrentCorrelationId(),
      data,
      environment: process.env.NODE_ENV || 'development'
    };

    // Immutable: create new array
    this.events = [...this.events, event];

    return event;
  }

  /**
   * Log trade decision
   */
  logTradeDecision(params: {
    decisionId: string;
    pair: string;
    confidence: number;
    expectedProfit: string;
    reasoning: Record<string, any>;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'TradeDecisionMade',
      {
        decisionId: params.decisionId,
        pair: params.pair,
        confidence: params.confidence,
        expectedProfit: params.expectedProfit,
        reasoning: params.reasoning
      },
      params.correlationId
    );
  }

  /**
   * Log successful trade execution
   */
  logTradeExecution(params: {
    tradeId: string;
    decisionId: string;
    pair: string;
    actualProfit: string;
    transactionHash: string;
    confirmations: number;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'TradeExecuted',
      {
        tradeId: params.tradeId,
        decisionId: params.decisionId,
        pair: params.pair,
        actualProfit: params.actualProfit,
        transactionHash: params.transactionHash,
        confirmations: params.confirmations,
        status: 'success'
      },
      params.correlationId
    );
  }

  /**
   * Log trade failure
   */
  logTradeFailure(params: {
    tradeId: string;
    decisionId: string;
    pair: string;
    error: string;
    errorType: string;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'TradeFailure',
      {
        tradeId: params.tradeId,
        decisionId: params.decisionId,
        pair: params.pair,
        error: params.error,
        errorType: params.errorType,
        status: 'failed'
      },
      params.correlationId
    );
  }

  /**
   * Log risk check execution
   */
  logRiskCheck(params: {
    checkName: string;
    passed: boolean;
    limit: string;
    actual: string;
    reason?: string;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      params.passed ? 'RiskCheckExecuted' : 'RiskCheckFailed',
      {
        checkName: params.checkName,
        passed: params.passed,
        limit: params.limit,
        actual: params.actual,
        reason: params.reason
      },
      params.correlationId
    );
  }

  /**
   * Log calculation
   */
  logCalculation(params: {
    operation: string;
    inputs: string[];
    result: string;
    precision: number;
    duration_ms: number;
    purpose?: string;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'CalculationPerformed',
      {
        operation: params.operation,
        inputs: params.inputs,
        result: params.result,
        precision: params.precision,
        duration_ms: params.duration_ms,
        purpose: params.purpose
      },
      params.correlationId
    );
  }

  /**
   * Log signal analysis
   */
  logSignalAnalysis(params: {
    signals: Record<string, any>;
    score: number;
    regimeDetected: string;
    confidence: number;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'SignalAnalyzed',
      {
        signals: params.signals,
        score: params.score,
        regimeDetected: params.regimeDetected,
        confidence: params.confidence
      },
      params.correlationId
    );
  }

  /**
   * Log model retraining
   */
  logModelRetrain(params: {
    modelVersion: number;
    dataPoints: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    trainingTime_ms: number;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'ModelRetrained',
      {
        modelVersion: params.modelVersion,
        dataPoints: params.dataPoints,
        metrics: {
          accuracy: params.accuracy,
          precision: params.precision,
          recall: params.recall,
          f1Score: params.f1Score
        },
        trainingTime_ms: params.trainingTime_ms
      },
      params.correlationId
    );
  }

  /**
   * Log model drift detection
   */
  logDriftDetection(params: {
    previousAccuracy: number;
    currentAccuracy: number;
    driftPercent: number;
    threshold: number;
    driftDetected: boolean;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'DriftDetected',
      {
        previousAccuracy: params.previousAccuracy,
        currentAccuracy: params.currentAccuracy,
        driftPercent: params.driftPercent,
        threshold: params.threshold,
        driftDetected: params.driftDetected
      },
      params.correlationId
    );
  }

  /**
   * Log system health check
   */
  logHealthCheck(params: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime_ms: number;
    memory_mb: number;
    cpu_percent: number;
    checks: Record<string, boolean>;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'SystemHealthCheck',
      {
        status: params.status,
        uptime_ms: params.uptime_ms,
        memory_mb: params.memory_mb,
        cpu_percent: params.cpu_percent,
        checks: params.checks
      },
      params.correlationId
    );
  }

  /**
   * Log circuit breaker trigger
   */
  logCircuitBreakerTriggered(params: {
    service: string;
    state: 'open' | 'half-open' | 'closed';
    failureCount: number;
    threshold: number;
    action: string;
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'CircuitBreakerTriggered',
      {
        service: params.service,
        state: params.state,
        failureCount: params.failureCount,
        threshold: params.threshold,
        action: params.action
      },
      params.correlationId
    );
  }

  /**
   * Log error
   */
  logError(params: {
    errorType: string;
    errorMessage: string;
    context: Record<string, any>;
    stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    correlationId?: string;
  }): LogEvent {
    return this.log(
      'ErrorOccurred',
      {
        errorType: params.errorType,
        errorMessage: params.errorMessage,
        context: params.context,
        stack: params.stack,
        severity: params.severity
      },
      params.correlationId
    );
  }

  /**
   * Get all events
   */
  getEvents(): ReadonlyArray<LogEvent> {
    return Object.freeze([...this.events]);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: EventType): LogEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }

  /**
   * Query events
   */
  query(filter: EventFilter): LogEvent[] {
    return this.events.filter(event => {
      if (filter.eventType && event.eventType !== filter.eventType) return false;
      if (filter.startTime && event.timestamp < filter.startTime) return false;
      if (filter.endTime && event.timestamp > filter.endTime) return false;
      if (filter.correlationId && event.correlationId !== filter.correlationId) return false;
      return true;
    }).slice(0, filter.limit || this.events.length);
  }

  /**
   * Get events by correlation ID
   * All events related to a single trade/decision
   */
  getEventsByCorrelation(correlationId: string): LogEvent[] {
    return this.events.filter(e => e.correlationId === correlationId);
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 10): LogEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get statistics
   */
  getStatistics(): EventStats {
    const byType: Record<EventType, number> = {} as Record<EventType, number>;

    for (const event of this.events) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
    }

    const timestamps = this.events.map(e => e.timestamp);
    const earliest = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
    const latest = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();

    return {
      totalEvents: this.events.length,
      byType,
      timeRange: {
        earliest,
        latest,
        duration_ms: latest - earliest
      }
    };
  }

  /**
   * Export all events as JSON
   */
  export(): { sessionId: string; events: LogEvent[] } {
    return {
      sessionId: this.sessionId,
      events: [...this.events]
    };
  }

  /**
   * Export as JSON string
   */
  exportJSON(): string {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * Export events in JSONL format (one JSON per line)
   * Good for streaming to external systems
   */
  exportJSONL(): string {
    return this.events
      .map(event => JSON.stringify(event))
      .join('\n');
  }

  /**
   * Clear all events
   * Only for testing
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get total event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Get summary for logging
   */
  getSummary(): string {
    const stats = this.getStatistics();
    const topEvents = Object.entries(stats.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => `${type}:${count}`)
      .join(' | ');

    return `Events: ${stats.totalEvents} | Top: ${topEvents}`;
  }
}

/**
 * Global structured logger instance
 * Used to track all system events
 */
export const globalStructuredLogger = new StructuredLogger();
