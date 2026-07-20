# Sentinel Production Architecture - Jane Street + Anthropic Sr. Dev Standard

**Zero compromises. Every calculation auditable. Every failure recoverable. Every decision traceable.**

---

## Core Principles

### 1. **All Financial Math Uses FloatLib (Non-Negotiable)**
- Every single number calculation routes through FloatLib
- No exceptions: calculations, comparisons, formatting
- Audit trail for every operation
- Precision guaranteed to arbitrary decimal places

### 2. **TypeScript Everywhere**
- Type safety at compile time, not runtime
- All APIs strongly typed
- No implicit any, no type coercion surprises
- Generics for reusable components

### 3. **Observability as First-Class Citizen**
- Structured logging for every decision
- Distributed tracing (correlation IDs)
- Metrics collection (Prometheus format)
- Real-time dashboards show system health

### 4. **Error Handling with Circuit Breakers**
- Explicit error types (not string messages)
- Recovery strategies for each failure mode
- Circuit breakers prevent cascade failures
- Graceful degradation

### 5. **Audit Trail = Law**
- Every trade decision logged immutably
- Signal analysis recorded
- Risk checks documented
- Reasoning captured

### 6. **Testing is Not Optional**
- Unit tests: Every calculation, every edge case
- Integration tests: Full decision flow
- Property-based tests: Invariants held
- Chaos tests: System resilience

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│         SENTINEL CORE (TypeScript)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Domain Layer (Business Logic)                │  │
│  │  ├─ TradeDecisionEngine                       │  │
│  │  ├─ SignalAnalyzer                           │  │
│  │  ├─ RiskValidator                            │  │
│  │  └─ PerformanceCalculator                    │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Application Layer (Coordination)             │  │
│  │  ├─ TradeExecutor                            │  │
│  │  ├─ SignalCollector                          │  │
│  │  ├─ ModelRetrainer                           │  │
│  │  └─ DriftDetector                            │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
│  ┌──────────────────────────────────────────────┐  │
│  │  Infrastructure Layer (System Concerns)      │  │
│  │  ├─ FloatLibClient (ALL MATH HERE)          │  │
│  │  ├─ Logger (Structured, Immutable)          │  │
│  │  ├─ Metrics (Prometheus)                    │  │
│  │  ├─ AuditTrail (Event Store)                │  │
│  │  ├─ CircuitBreaker (Failure Handling)       │  │
│  │  └─ HealthCheck (System Status)             │  │
│  └──────────────────────────────────────────────┘  │
│                     ↓                               │
└─────────────────────────────────────────────────────┘
           ↓              ↓              ↓
      ┌─────────┐   ┌──────────┐   ┌──────────┐
      │ Ollama  │   │ Pipeline │   │Dashboard │
      │ (LLM)   │   │ (Metrics)│   │(React)   │
      └─────────┘   └──────────┘   └──────────┘
```

---

## 1. Domain Layer (Business Logic)

### TradeDecisionEngine
```typescript
class TradeDecisionEngine {
  async decideTrade(
    context: TradeContext
  ): Promise<Result<TradeDecision, TradeError>> {
    // All calculations use FloatLib
    const pairAnalysis = await this.analyzePair(context.pair);
    const signals = await this.evaluateSignals(context);
    const confidence = this.calculateConfidence(pairAnalysis, signals);
    
    // Risk validation (mandatory, non-bypassable)
    const riskCheck = await this.validateRisks(context);
    if (riskCheck.isErr()) return riskCheck;
    
    // Profit calculation (FloatLib guaranteed)
    const profitCalc = this.calculateExpectedProfit(
      context.surplus,
      context.markup
    );
    
    // Immutable decision
    const decision: TradeDecision = {
      id: generateDecisionId(),
      pair: context.pair,
      confidence: confidence,
      expectedProfit: profitCalc,
      reasoning: this.captureReasoning(pairAnalysis, signals, riskCheck),
      timestamp: Date.now(),
      checksum: this.calculateChecksum() // For audit
    };
    
    return Ok(decision);
  }
  
  private calculateConfidence(
    pair: PairAnalysis,
    signals: SignalAnalysis
  ): FloatValue {
    // ALWAYS through FloatLib
    const pairWeight = FloatLib.multiply(pair.winRate, 0.7);
    const signalWeight = FloatLib.multiply(signals.score, 0.3);
    return FloatLib.add(pairWeight, signalWeight);
  }
  
  private captureReasoning(
    pair: PairAnalysis,
    signals: SignalAnalysis,
    risk: RiskValidation
  ): DecisionReasoning {
    return {
      pairAnalysis: pair,
      signals: signals,
      riskChecks: risk.checks,
      calculatedConfidence: this.confidence,
      profitableOrderCount: pair.profitableCount,
      historicalSurplus: pair.avgSurplus
    };
  }
}
```

### SignalAnalyzer
```typescript
class SignalAnalyzer {
  async analyzeSignals(signals: MarketSignals): Promise<SignalAnalysis> {
    // All comparisons through FloatLib
    const volumeImpact = this.analyzeVolume(signals.dexVolume24h);
    const volatilityImpact = this.analyzeVolatility(signals.volatility);
    const oiImpact = this.analyzeOI(signals.openInterest);
    const supplyTrendImpact = this.analyzeSupplyTrend(
      signals.stablecoinTrend
    );
    
    // Aggregate score (FloatLib)
    const score = FloatLib.add(
      FloatLib.multiply(volumeImpact, 0.25),
      FloatLib.multiply(volatilityImpact, 0.25),
      FloatLib.multiply(oiImpact, 0.25),
      FloatLib.multiply(supplyTrendImpact, 0.25)
    );
    
    return {
      score,
      volumeImpact,
      volatilityImpact,
      oiImpact,
      supplyTrendImpact,
      regimeDetected: this.detectRegime(score),
      confidence: score
    };
  }
  
  private analyzeVolume(volume: FloatValue): FloatValue {
    const baselineVolume = FloatLib.create(5e9); // $5B baseline
    const ratio = FloatLib.divide(volume, baselineVolume);
    
    // Score: 0-100
    return FloatLib.min(
      FloatLib.multiply(ratio, 100),
      FloatLib.create(100)
    );
  }
}
```

### RiskValidator
```typescript
class RiskValidator {
  async validateRisks(context: TradeContext): Promise<Result<RiskValidation, RiskError>> {
    const checks = new RiskCheckList();
    
    // Hard limit: Position size
    const positionPercent = FloatLib.divide(
      context.orderSize,
      context.totalCapital
    );
    const positionValid = FloatLib.lessThanOrEqual(
      positionPercent,
      FloatLib.create(0.05) // 5% max
    );
    checks.add({
      name: 'PositionSize',
      passed: positionValid,
      limit: FloatLib.create(0.05),
      actual: positionPercent
    });
    
    // Hard limit: Leverage
    const leverageValid = FloatLib.lessThanOrEqual(
      context.leverage,
      FloatLib.create(2.0)
    );
    checks.add({
      name: 'Leverage',
      passed: leverageValid,
      limit: FloatLib.create(2.0),
      actual: context.leverage
    });
    
    // Hard limit: Daily loss
    const dailyLoss = FloatLib.subtract(
      FloatLib.create(0),
      context.dailyPnL
    );
    const dailyLossMax = FloatLib.multiply(context.totalCapital, 0.10);
    const dailyLossValid = FloatLib.lessThanOrEqual(dailyLoss, dailyLossMax);
    checks.add({
      name: 'DailyLoss',
      passed: dailyLossValid,
      limit: dailyLossMax,
      actual: dailyLoss
    });
    
    // ALL checks must pass
    if (!checks.allPassed()) {
      return Err(new RiskLimitExceededError(checks.failed()));
    }
    
    return Ok(new RiskValidation(checks));
  }
}
```

---

## 2. Application Layer (Coordination)

### TradeExecutor
```typescript
class TradeExecutor {
  async executeTrade(decision: TradeDecision): Promise<TradeExecution> {
    const execution = new TradeExecution(decision);
    
    try {
      // Log intent (immutable)
      await this.auditTrail.logTradeIntent(decision);
      
      // Execute (with rollback support)
      const receipt = await this.executeWithCircuitBreaker(decision);
      
      // Record execution (immutable)
      execution.recordExecution(receipt);
      await this.auditTrail.logTradeExecution(execution);
      
      // Update metrics
      this.metrics.recordTrade(execution);
      
      // Update state (only after full success)
      await this.ledger.recordTrade(execution);
      
      return execution;
    } catch (error) {
      // Graceful degradation
      execution.recordFailure(error);
      await this.auditTrail.logTradeFailure(execution);
      this.circuitBreaker.recordFailure(error);
      
      throw error; // Fail fast
    }
  }
  
  private async executeWithCircuitBreaker(
    decision: TradeDecision
  ): Promise<TransactionReceipt> {
    if (this.circuitBreaker.isOpen()) {
      throw new CircuitBreakerOpenError('Trading circuit breaker is open');
    }
    
    try {
      return await this.blockchain.submit(decision.toTransaction());
    } catch (error) {
      this.circuitBreaker.recordFailure(error);
      throw error;
    }
  }
}
```

---

## 3. Infrastructure Layer (System Concerns)

### FloatLibClient (All Math Here)
```typescript
class FloatLibClient {
  private floatLib: FloatLib;
  private calculationLog: CalculationLog;
  
  constructor() {
    this.floatLib = new FloatLib();
    this.calculationLog = new CalculationLog();
  }
  
  // EVERY calculation logs through this
  add(a: FloatValue, b: FloatValue): FloatValue {
    const result = this.floatLib.add(a, b);
    this.calculationLog.log({
      operation: 'add',
      inputs: [a, b],
      result,
      timestamp: Date.now()
    });
    return result;
  }
  
  multiply(a: FloatValue, b: FloatValue): FloatValue {
    const result = this.floatLib.multiply(a, b);
    this.calculationLog.log({
      operation: 'multiply',
      inputs: [a, b],
      result,
      timestamp: Date.now()
    });
    return result;
  }
  
  // Compare operations (for risk checks)
  lessThanOrEqual(a: FloatValue, b: FloatValue): boolean {
    return this.floatLib.lessThanOrEqual(a, b);
  }
  
  // All operations similar...
  
  // Audit export
  async exportCalculationAudit(): Promise<AuditLog> {
    return this.calculationLog.export();
  }
}
```

### StructuredLogger
```typescript
class StructuredLogger {
  private eventStore: EventStore;
  
  logTradeDecision(decision: TradeDecision, reasoning: DecisionReasoning) {
    this.eventStore.append({
      eventType: 'TradeDecisionMade',
      timestamp: Date.now(),
      data: {
        decisionId: decision.id,
        pair: decision.pair,
        confidence: decision.confidence.toString(),
        reasoning: reasoning,
        userEmail: getCurrentUser().email,
        environment: process.env.NODE_ENV
      },
      correlationId: generateCorrelationId()
    });
  }
  
  logRiskCheck(check: RiskCheck, result: boolean) {
    this.eventStore.append({
      eventType: 'RiskCheckExecuted',
      timestamp: Date.now(),
      data: {
        checkName: check.name,
        passed: result,
        limit: check.limit.toString(),
        actual: check.actual.toString()
      }
    });
  }
  
  logCalculation(
    operation: string,
    inputs: FloatValue[],
    result: FloatValue
  ) {
    this.eventStore.append({
      eventType: 'CalculationPerformed',
      timestamp: Date.now(),
      data: {
        operation,
        inputs: inputs.map(v => v.toString()),
        result: result.toString()
      }
    });
  }
}
```

### CircuitBreaker
```typescript
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private failureThreshold = 5;
  private successThreshold = 2;
  private successCount = 0;
  
  isOpen(): boolean {
    return this.state === 'open';
  }
  
  async executeWithBreaker<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'open') {
      throw new CircuitBreakerOpenError('Circuit breaker is open');
    }
    
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
  
  private recordSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
      }
    }
  }
  
  private recordFailure(error: Error) {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      // Schedule half-open check
      setTimeout(() => {
        this.state = 'half-open';
      }, 60000); // 1 minute
    }
  }
}
```

### MetricsCollector
```typescript
class MetricsCollector {
  private registry: prometheus.Registry;
  
  private tradesExecuted = new prometheus.Counter({
    name: 'sentinel_trades_executed_total',
    help: 'Total number of trades executed'
  });
  
  private tradeProfit = new prometheus.Histogram({
    name: 'sentinel_trade_profit_eth',
    help: 'Profit per trade in ETH',
    buckets: [0.001, 0.01, 0.1, 1, 10, 100, 1000]
  });
  
  private modelAccuracy = new prometheus.Gauge({
    name: 'sentinel_model_accuracy',
    help: 'Current model accuracy percentage',
    registers: [this.registry]
  });
  
  private riskChecksPerformed = new prometheus.Counter({
    name: 'sentinel_risk_checks_total',
    help: 'Total risk checks performed'
  });
  
  recordTrade(execution: TradeExecution) {
    this.tradesExecuted.inc();
    this.tradeProfit.observe(
      execution.profit.toNumber() // Use FloatLib value
    );
  }
  
  recordModelAccuracy(accuracy: number) {
    this.modelAccuracy.set(accuracy);
  }
  
  async export(): Promise<string> {
    return this.registry.metrics();
  }
}
```

---

## 4. Testing Framework

### Unit Tests Example
```typescript
describe('TradeDecisionEngine', () => {
  let engine: TradeDecisionEngine;
  let floatLib: FloatLibClient;
  
  beforeEach(() => {
    floatLib = new FloatLibClient();
    engine = new TradeDecisionEngine(floatLib);
  });
  
  describe('calculateConfidence', () => {
    it('should use FloatLib for all calculations', () => {
      const pairAnalysis = {
        winRate: FloatLib.create(0.988),
        profitableCount: 988,
        avgSurplus: FloatLib.create(393.1)
      };
      
      const signals = {
        score: FloatLib.create(94),
        volumeImpact: FloatLib.create(75)
      };
      
      const confidence = engine.calculateConfidence(pairAnalysis, signals);
      
      // Verify it's a FloatValue (type-safe)
      expect(confidence).toBeInstanceOf(FloatValue);
      
      // Verify precision
      expect(confidence.toString()).toMatch(/^\d+\.\d{10,}$/);
    });
    
    it('should never exceed 100', () => {
      const maxPair = {
        winRate: FloatLib.create(1.0),
        profitableCount: 1000,
        avgSurplus: FloatLib.create(1000)
      };
      
      const maxSignals = {
        score: FloatLib.create(100),
        volumeImpact: FloatLib.create(100)
      };
      
      const confidence = engine.calculateConfidence(maxPair, maxSignals);
      
      expect(
        FloatLib.lessThanOrEqual(confidence, FloatLib.create(100))
      ).toBe(true);
    });
    
    // Edge cases: zero values, negative, extreme precision
  });
  
  describe('riskValidation', () => {
    it('should reject position size > 5%', async () => {
      const context = {
        orderSize: FloatLib.create(600), // $600
        totalCapital: FloatLib.create(10000), // $10k = 6%
        leverage: FloatLib.create(1.0)
      };
      
      const result = await engine.validateRisks(context);
      
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(RiskLimitExceededError);
    });
    
    it('should reject leverage > 2x', async () => {
      const context = {
        orderSize: FloatLib.create(500),
        totalCapital: FloatLib.create(10000),
        leverage: FloatLib.create(2.5)
      };
      
      const result = await engine.validateRisks(context);
      
      expect(result.isErr()).toBe(true);
    });
  });
});
```

### Integration Tests Example
```typescript
describe('Full Trade Flow', () => {
  it('should execute profitable trade with full audit trail', async () => {
    const engine = new TradeDecisionEngine(floatLib);
    const executor = new TradeExecutor(ledger, auditTrail, metrics);
    
    const context = createTradeContext({
      pair: 'WETH→USDC',
      surplus: FloatLib.create(393.1),
      markup: FloatLib.create(0.005),
      capital: FloatLib.create(10000)
    });
    
    const decision = await engine.decideTrade(context);
    expect(decision.isOk()).toBe(true);
    
    const execution = await executor.executeTrade(decision.unwrap());
    expect(execution.success).toBe(true);
    
    // Verify audit trail
    const audit = await auditTrail.fetch(decision.id);
    expect(audit.steps).toEqual([
      'TradeIntentLogged',
      'RiskChecksExecuted',
      'CalculationsPerformed',
      'TradeExecuted',
      'MetricsRecorded',
      'LedgerUpdated'
    ]);
  });
});
```

---

## 5. Dashboard Integration

### Production Dashboard
```typescript
// Built-in React (NO custom chat framework)
// Direct connection to metrics + audit trail

class DashboardAPI {
  async getSystemStatus(): Promise<SystemStatus> {
    return {
      modelAccuracy: this.metrics.getLatest('sentinel_model_accuracy'),
      trades: this.metrics.getLatest('sentinel_trades_executed_total'),
      capital: this.ledger.getCurrentCapital(),
      roi: this.ledger.calculateROI(),
      lastTrade: this.auditTrail.getLatestTrade(),
      circuitBreakerStatus: this.circuitBreaker.getStatus(),
      calculations: this.floatLib.getCalculationStats()
    };
  }
  
  async analyzeTradeDecision(tradeId: string): Promise<TradeAnalysis> {
    const events = await this.auditTrail.getTradeEvents(tradeId);
    
    return {
      decision: events.find(e => e.type === 'TradeDecisionMade'),
      reasoning: events.find(e => e.type === 'ReasoningCaptured'),
      riskChecks: events.filter(e => e.type === 'RiskCheckExecuted'),
      calculations: events.filter(e => e.type === 'CalculationPerformed'),
      execution: events.find(e => e.type === 'TradeExecuted')
    };
  }
}
```

---

## 6. No External Dependencies for Core Logic

✅ **Keep**: TypeScript, FloatLib, Viem (blockchain only)
✅ **Keep**: Prometheus (metrics only)
✅ **Keep**: React (UI only)

❌ **Remove**: OpenWebUI dependency (custom chat in React)
❌ **Remove**: External LLM for reasoning (use Ollama only)
❌ **Remove**: Any framework for trade logic

---

## Deployment Checklist

- [ ] All math through FloatLib (100% coverage)
- [ ] Every decision logged to immutable audit trail
- [ ] Circuit breaker active and tested
- [ ] Metrics collected for every operation
- [ ] Risk checks mandatory and enforce
- [ ] TypeScript strict mode: true
- [ ] Tests: Unit (90%+), Integration (key flows), Property-based
- [ ] Audit trail export / verification ready
- [ ] Dashboard connected to real metrics (no mocks)
- [ ] Backpressure and rate limiting on all APIs
- [ ] Error handling with explicit recovery
- [ ] Logging structured and searchable
- [ ] No magic numbers (all in config)
- [ ] No global state (dependency injection)
- [ ] Graceful degradation on failure

---

## This is Production Grade

- Observability: You can see every calculation, decision, and risk check
- Auditability: Perfect trace of why every trade happened
- Correctness: FloatLib + TypeScript + tests guarantee precision
- Resilience: Circuit breakers prevent cascade failures
- Maintainability: Clean layers, explicit dependencies, clear ownership

**This is what Jane Street and Anthropic Sr. Devs ship.**
