# TESTING & VERIFICATION GUIDE

**Comprehensive testing strategy for production deployment**

---

## PHASE 5: UNIT & INTEGRATION TESTING

### Unit Test Structure

Each component has focused unit tests:

```typescript
// lib/__tests__/RiskValidator.test.ts
describe('RiskValidator', () => {
  describe('Position Size Check', () => {
    it('should reject position > 5%', () => {
      const validator = new RiskValidator(...);
      expect(() => validator.validate({
        position: 600,
        totalCapital: 10000, // 6% > 5% limit
        leverage: 1.0,
        dailyLoss: 0,
        currentDrawdown: 0
      })).toThrow(RiskLimitExceededError);
    });
    
    it('should accept position = 5% exactly', () => {
      const validator = new RiskValidator(...);
      const result = validator.validate({
        position: 500,
        totalCapital: 10000, // 5% = limit
        leverage: 1.0,
        dailyLoss: 0,
        currentDrawdown: 0
      });
      expect(result.allChecksPassed).toBe(true);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero capital', () => {
      expect(() => validator.validate({
        position: 100,
        totalCapital: 0,
        leverage: 1.0,
        dailyLoss: 0,
        currentDrawdown: 0
      })).toThrow();
    });
    
    it('should handle extreme precision', () => {
      const result = validator.validate({
        position: '0.000000000000000001', // Very small
        totalCapital: '10000',
        leverage: '1.0',
        dailyLoss: '0',
        currentDrawdown: '0'
      });
      expect(result.allChecksPassed).toBe(true);
    });
  });
});
```

### Integration Test Structure

```typescript
// lib/__tests__/Sentinel.test.ts
describe('Sentinel Full Trading Cycle', () => {
  it('should execute complete trade flow', async () => {
    const sentinel = new Sentinel();
    
    const result = await sentinel.executeTradingCycle({
      pair: 'WETH→USDC',
      pairHistory: {
        pair: 'WETH→USDC',
        profitableTradesCount: 988,
        totalTradesCount: 1000,
        winRate: 0.988,
        averageSurplus: '393.1',
        volatilityObserved: 45
      },
      signals: {
        dexVolume24h: 5.2e9,
        volatility: 60,
        openInterest: 5e9,
        stablecoinTrend: 'risk-on',
        wethPrice: 2500.32
      },
      totalCapital: '10000',
      currentLeverage: '1.0',
      dailyLoss: '0',
      currentDrawdown: '0',
      surplus: '100'
    });
    
    expect(result.decision).toBeDefined();
    expect(result.decision.shouldExecute).toBe(true);
    expect(result.execution).toBeDefined();
    expect(result.execution.status).toBe('confirmed');
  });
  
  it('should reject trade if risk checks fail', async () => {
    const sentinel = new Sentinel();
    
    const result = await sentinel.executeTradingCycle({
      // ... params with position > 5%
      surplus: '700' // 7% of $10k capital
    });
    
    expect(result.decision.shouldExecute).toBe(false);
    expect(result.decision.rejectionReason).toContain('Risk');
  });
});
```

### Test Categories

| Category | Count | Coverage |
|----------|-------|----------|
| Unit Tests | 150+ | 90%+ |
| Integration Tests | 40+ | All critical flows |
| Edge Cases | 60+ | Boundary conditions |
| Error Cases | 50+ | All error types |
| Performance | 20+ | Speed benchmarks |
| **Total** | **320+** | **Full system** |

---

## PHASE 6: VERIFICATION & AUDIT

### Audit Checklist

#### 1. FloatLib Audit ✓
All calculations must use FloatLib, logged via CalculationLogger.

```typescript
// scripts/audit-floatlib-usage.ts

async function auditFloatLibUsage() {
  const calculationLog = sentinel.getCalculationLog();
  
  // Must have operations for:
  // - ROI calculation
  // - Position size calculation
  // - Sharpe ratio calculation
  // - Confidence calculation
  // - All comparisons (<=, >=, etc)
  
  const operations = calculationLog.byOperation;
  const expectedOps = [
    'add', 'subtract', 'multiply', 'divide',
    'lessThanOrEqual', 'greaterThanOrEqual',
    'percentage', 'positionSize', 'roi', 'sharpeRatio'
  ];
  
  for (const op of expectedOps) {
    if (!operations[op]) {
      console.error(`Missing FloatLib operation: ${op}`);
    }
  }
  
  console.log(`✅ FloatLib Audit: ${calculationLog.totalOperations} operations tracked`);
}
```

#### 2. Audit Trail Verification ✓
All decisions must be logged and traceable.

```typescript
// scripts/verify-audit-trail.ts

async function verifyAuditTrail() {
  const auditLog = sentinel.getAuditLog();
  const events = auditLog.events;
  
  // For each trade decision:
  const tradeDecisions = events.filter(e => e.eventType === 'TradeDecisionMade');
  
  for (const decision of tradeDecisions) {
    const correlationId = decision.correlationId;
    
    // Verify related events exist:
    const relatedEvents = events.filter(e => e.correlationId === correlationId);
    
    // Must have:
    // - Signal analysis
    // - Risk checks (4 types)
    // - Confidence calculation
    // - Trade execution or rejection
    
    const hasSignalAnalysis = relatedEvents.some(e => e.eventType === 'SignalAnalyzed');
    const hasRiskChecks = relatedEvents.filter(e => e.eventType === 'RiskCheckExecuted').length === 4;
    const hasExecution = relatedEvents.some(e => 
      e.eventType === 'TradeExecuted' || e.eventType === 'TradeFailure'
    );
    
    if (!hasSignalAnalysis || !hasRiskChecks || !hasExecution) {
      console.error(`Incomplete audit trail for decision ${correlationId}`);
    }
  }
  
  console.log(`✅ Audit Trail Verification: ${events.length} events verified`);
}
```

#### 3. Risk Check Enforcement ✓
All 4 risk checks must be enforced before ANY trade.

```typescript
// scripts/verify-risk-enforcement.ts

async function verifyRiskEnforcement() {
  const auditLog = sentinel.getAuditLog();
  const events = auditLog.events;
  
  // Find all trades
  const tradeExecutions = events.filter(e => e.eventType === 'TradeExecuted');
  
  // Each trade must have 4 risk checks that passed
  for (const trade of tradeExecutions) {
    const correlationId = trade.correlationId;
    const riskChecks = events.filter(e => 
      e.correlationId === correlationId && 
      e.eventType === 'RiskCheckExecuted'
    );
    
    if (riskChecks.length !== 4) {
      console.error(`Trade ${correlationId} has only ${riskChecks.length} risk checks (need 4)`);
    }
    
    for (const check of riskChecks) {
      if (!check.data.passed) {
        console.error(`Risk check failed but trade executed: ${check.data.checkName}`);
      }
    }
  }
  
  console.log(`✅ Risk Enforcement: All ${tradeExecutions.length} trades have mandatory checks`);
}
```

#### 4. Calculation Immutability ✓
All calculations in CalculationLogger must be immutable.

```typescript
// scripts/verify-calculation-immutability.ts

async function verifyCalculationImmutability() {
  const calcLog = sentinel.getCalculationLog();
  const operations = calcLog.operations;
  
  // Verify:
  // 1. No operation is modified after creation
  // 2. IDs are unique
  // 3. Timestamps are monotonically increasing
  // 4. Session ID consistent
  
  const ids = new Set();
  let lastTimestamp = 0;
  
  for (const op of operations) {
    if (ids.has(op.id)) {
      console.error(`Duplicate operation ID: ${op.id}`);
    }
    ids.add(op.id);
    
    if (op.timestamp < lastTimestamp) {
      console.error(`Timestamp not monotonically increasing: ${op.timestamp} after ${lastTimestamp}`);
    }
    lastTimestamp = op.timestamp;
    
    if (op.sessionId !== calcLog.sessionId) {
      console.error(`Session ID mismatch in operation`);
    }
  }
  
  console.log(`✅ Immutability Verified: ${operations.length} operations, all immutable`);
}
```

#### 5. Error Handling Coverage ✓
All error types must be properly caught and recovered.

```typescript
// scripts/verify-error-handling.ts

async function verifyErrorHandling() {
  // Simulate various failure scenarios
  const tests = [
    { name: 'Risk limit exceeded', test: () => testRiskViolation() },
    { name: 'Blockchain failure', test: () => testBlockchainFailure() },
    { name: 'Signal fetch failure', test: () => testSignalFetchFailure() },
    { name: 'Model training failure', test: () => testModelTrainingFailure() }
  ];
  
  for (const testCase of tests) {
    try {
      await testCase.test();
      console.log(`✅ ${testCase.name}: Recovered gracefully`);
    } catch (error) {
      console.error(`❌ ${testCase.name}: Not recovered - ${error.message}`);
    }
  }
}
```

### Verification Steps

1. **Build & Type Check**
   ```bash
   npm run build
   npm run typecheck
   ```

2. **Run Unit Tests**
   ```bash
   npm run test:unit
   # Expected: 150+ tests, 90%+ coverage
   ```

3. **Run Integration Tests**
   ```bash
   npm run test:integration
   # Expected: 40+ tests, all critical flows covered
   ```

4. **Run Verification Scripts**
   ```bash
   npm run verify:floatlib
   npm run verify:audit-trail
   npm run verify:risk-enforcement
   npm run verify:immutability
   npm run verify:errors
   ```

5. **Load Testing**
   ```bash
   npm run test:load
   # 1M operations, <100ms each, no memory leaks
   ```

6. **Security Audit**
   ```bash
   npm run security:audit
   # Check for vulnerabilities in dependencies
   ```

### Expected Results

| Metric | Target | Method |
|--------|--------|--------|
| Test Coverage | 90%+ | Istanbul coverage report |
| FloatLib Usage | 100% | Audit script |
| Audit Trail | Complete | Event verification |
| Risk Enforcement | 100% | Risk check audit |
| Error Recovery | All types | Error simulation tests |
| Performance | <100ms/op | Benchmark suite |
| Memory | No leaks | Heap analysis |
| Type Safety | No errors | TypeScript strict check |

---

## DEPLOYMENT READINESS

After all tests pass:

✅ Code review by senior engineers  
✅ Security audit completed  
✅ Load tested to 1M+ operations  
✅ Audit trail verified  
✅ FloatLib usage audit passed  
✅ All risk limits enforced  
✅ Disaster recovery tested  
✅ Error recovery verified  

**Ready for mainnet deployment.**

---

## TEST EXECUTION TIMELINE

- **Phase 5 Testing**: 3 days
  - Unit tests: 1 day
  - Integration tests: 1 day
  - Edge cases & performance: 1 day

- **Phase 6 Verification**: 2 days
  - Audit execution: 1 day
  - Load testing: 1 day
  - Final review: same day

**Total: 5 days from now**

Ready to execute testing phase?
