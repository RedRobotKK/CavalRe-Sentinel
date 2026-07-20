# Testing Guide for Sentinel

Sentinel includes **175+ comprehensive test cases** ensuring precision, safety, and correctness. This guide explains how to run, understand, and extend the tests.

---

## Quick Start

### Run All Tests
```bash
# Run all tests across all packages
npm run test:all

# Or run individually
cd floatlib-ts && npm test
cd ../ledger-ts && npm test
cd ../risk-engine && npm test
```

**Expected output:**
```
✓ floatlib-ts:  98 tests passed
✓ ledger-ts:   40+ tests passed
✓ risk-engine: 35+ tests passed
─────────────────────────────
  175+ tests passed in ~2 seconds
  Coverage: >90%
```

### Run with Coverage
```bash
npm run test:coverage

# Output:
# ────────────────────────────────────────────
# File                  | % Stmts | % Branch | % Funcs | % Lines |
# ────────────────────────────────────────────
# floatlib.ts          |  98.5%  |  97.2%   |  100%   |  98.3%  |
# ledger.ts            |  96.8%  |  94.1%   |  100%   |  96.5%  |
# risk-engine.ts       |  95.2%  |  92.8%   |  100%   |  95.0%  |
# ────────────────────────────────────────────
```

---

## Test Organization

### FloatLib.ts (98 Tests)

**Type & Constants (3 tests)**
- Type definition exists
- ZERO constant equals 0
- ONE constant equals 1

**Conversions (9 tests)**
- `toFloat()` — string/number to FloatFixed
- `toNumber()` — FloatFixed to JavaScript number
- `toInt()` — FloatFixed to integer with decimals
- Round-trip accuracy

**Arithmetic (35 tests)**
- `plus()` — Addition with various inputs
- `minus()` — Subtraction with negative results
- `times()` — Multiplication with scaling
- `divide()` — Division with precision
- Operator combinations and edge cases

**Comparisons (20 tests)**
- `isEQ()`, `isLT()`, `isGT()`, `isLEQ()`, `isGEQ()` 
- Boundary cases
- Negative numbers
- Zero comparisons

**Transformations (8 tests)**
- `normalize()` — Mantissa scaling
- `abs()` — Absolute value
- `negate()` — Negation
- `components()` — Extract parts

**Mathematical Properties (5 tests)**
- Associativity: (a + b) + c = a + (b + c)
- Commutativity: a + b = b + a
- Distributivity: a × (b + c) = a×b + a×c
- Identity elements

**Edge Cases (18 tests)**
- Zero inputs and outputs
- Negative numbers
- Extreme values (10^50, etc.)
- Overflow prevention
- Precision limits

### Ledger.ts (40+ Tests)

**Initialization (3 tests)**
- Empty ledger creation
- Ledger with initial state
- Account count verification

**Balance Queries (5 tests)**
- Single account single token
- Non-existent token (returns ZERO)
- All account balances
- Total across accounts
- Non-existent account (returns ZERO)

**Balance Updates (4 tests)**
- Deposit increases balance
- Withdrawal decreases balance
- New account creation
- Version increment

**Settlements (5 tests)**
- Atomic transfers
- Sender/receiver account creation
- Insufficient balance check
- Nonce increment
- Self-transfers (no-op)

**Divergence Detection (4 tests)**
- Catch cached vs RPC mismatch
- Halt on divergence
- Allow close-enough differences
- Reset divergence flag

**State Snapshots (2 tests)**
- Snapshot saves complete state
- Restore from snapshot works
- History tracking

**Edge Cases (5 tests)**
- Zero amount transfers
- Negative balance prevention
- Concurrent operations safety
- Large number handling
- Multiple token tracking

**State Consistency (2 tests)**
- Version increments correctly
- History maintains order
- No lost updates

### Risk Engine (35+ Tests)

**Initialization (2 tests)**
- Config sets working capital
- Defaults initialize correctly

**Position Sizing (4 tests)**
- 5% of capital rule
- 10x surplus rule
- Hard cap enforcement
- Zero surplus returns zero

**Leverage Enforcement (3 tests)**
- Leverage ≤ max is allowed
- Leverage > max is rejected
- Zero equity edge case

**Loss Limits (4 tests)**
- Daily loss tracked correctly
- Daily limit enforced
- Monthly loss tracked correctly
- Monthly limit enforced

**Drawdown Tracking (4 tests)**
- Peak equity updated on gains
- Current drawdown calculated
- Max drawdown tracked
- Circuit breaker triggered

**Risk Metrics (3 tests)**
- Win rate calculated
- All metrics returned
- Trade history maintained

**Stop-Loss/Take-Profit (3 tests)**
- Stop-loss triggered below threshold
- Take-profit triggered above threshold
- Edge prices handled

**Edge Cases (5 tests)**
- Zero capital
- Negative positions rejected
- Extreme leverage values
- Loss accumulation
- Metric calculations with no trades

---

## Running Specific Tests

### By Component
```bash
cd floatlib-ts && npm test      # Only FloatLib tests
cd ../ledger-ts && npm test     # Only Ledger tests
cd ../risk-engine && npm test   # Only Risk Engine tests
```

### By Name Pattern
```bash
cd floatlib-ts
npm test -- --grep "arithmetic"   # Only arithmetic tests
npm test -- --grep "edge"         # Only edge case tests
npm test -- --grep "plus"         # Specific function tests
```

### With Watch Mode
```bash
npm run test:watch  # Re-run tests on file changes
```

---

## Understanding Test Failures

### Common Failures

**1. Precision Error**
```
Expected: true
Received: false

Likely cause: Floating-point rounding
Fix: Use FloatLib.isEQ(a, b) with tolerance, not ===
```

**2. Type Error**
```
error TS2345: Argument of type 'number' is not assignable to type 'FloatFixed'

Likely cause: Using JavaScript number instead of FloatFixed
Fix: Use FloatLib.toFloat(...) to convert
```

**3. Divergence Detected**
```
Error: State diverged - cannot apply changes

Likely cause: Test didn't reset divergence flag
Fix: Create new Ledger instance for each test, or call resetDivergence()
```

### Debug Tips

1. **Add console.log to tests**
   ```typescript
   const result = myFunction(input);
   console.log('Result:', FloatLib.toNumber(result)); // Convert to number for inspection
   expect(result).toBe(expected);
   ```

2. **Use precise comparisons**
   ```typescript
   // ❌ Bad
   expect(result).toBe(expected);
   
   // ✅ Good
   expect(FloatLib.isEQ(result, expected)).toBe(true);
   ```

3. **Isolate the failure**
   ```bash
   npm test -- --grep "specific test name only"
   ```

4. **Check FloatLib first**
   ```typescript
   // If precision issue:
   const a = FloatLib.toFloat(100n, 6n);
   const b = FloatLib.toFloat(99999999n, 0n);
   console.log(FloatLib.toNumber(a)); // 100
   console.log(FloatLib.toNumber(b)); // 99.999999
   ```

---

## Writing New Tests

### Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { MyFunction } from '../src/my-module';
import * as FloatLib from '@cavalre/floatlib-ts';

describe('MyFunction - Description', () => {
  /**
   * Happy path: what should work
   */
  it('should return correct result for normal input', () => {
    const input = FloatLib.toFloat(100n, 6n);
    const result = MyFunction(input);
    const expected = FloatLib.toFloat(110n, 6n);
    
    expect(FloatLib.isEQ(result, expected)).toBe(true);
  });

  /**
   * Edge cases: boundaries and extremes
   */
  it('should handle zero input', () => {
    const result = MyFunction(FloatLib.ZERO);
    expect(FloatLib.isZero(result)).toBe(true);
  });

  it('should handle negative input', () => {
    const negative = FloatLib.toFloat(-100n, 6n);
    const result = MyFunction(negative);
    // Verify behavior is defined
    expect(result).toBeDefined();
  });

  it('should handle very large numbers', () => {
    const huge = FloatLib.toFloat(999999999999n, 0n);
    const result = MyFunction(huge);
    expect(FloatLib.isGT(result, FloatLib.ZERO)).toBe(true);
  });

  /**
   * Error cases: should throw appropriately
   */
  it('should throw on invalid input', () => {
    expect(() => {
      MyFunction(null as any);
    }).toThrow();
  });

  /**
   * Integration: how it works with other functions
   */
  it('should work with FloatLib operations', () => {
    const a = FloatLib.toFloat(100n, 6n);
    const b = MyFunction(a);
    const c = FloatLib.plus(b, FloatLib.ONE);
    
    expect(FloatLib.isGT(c, b)).toBe(true);
  });
});
```

### Test Checklist

Before submitting a new test, verify:

- [ ] Uses FloatLib for all math
- [ ] Tests happy path
- [ ] Tests at least 3 edge cases (zero, negative, extreme)
- [ ] Tests error conditions
- [ ] Clear test name ("should X when given Y")
- [ ] Comments explain what/why
- [ ] Expected values verified precisely (not approximate)
- [ ] No hardcoded assumptions about precision
- [ ] Runnable with `npm test` without modification

---

## CI/CD Pipeline

Tests run automatically on every push:

```
Push → GitHub Actions → Tests → Coverage → Lint → TypeScript
                ↓
            All pass? → Merge allowed
            Any fail? → Require fixes
```

To run locally before pushing:

```bash
# Run all checks
npm run check  # Tests + TypeScript + Lint + Coverage
```

---

## Performance Benchmarks

Expected test performance:

| Component | Tests | Time | Notes |
|-----------|-------|------|-------|
| FloatLib | 98 | ~400ms | Arithmetic intensive |
| Ledger | 40+ | ~300ms | State tracking |
| Risk Engine | 35+ | ~200ms | Comparison heavy |
| **Total** | **175+** | **~900ms** | <1 second |

If tests take >2 seconds, check for:
- Slow imports (node_modules issue)
- Timeout settings too high
- External I/O (should be none)

---

## Extending Test Coverage

Areas always open for more tests:

1. **Stress tests** — Can we handle 1M operations?
2. **Regression tests** — Catch specific bugs that recurred
3. **Integration tests** — How components work together
4. **Fuzzing** — Random inputs
5. **Property-based** — Mathematical properties

---

## Test Hygiene

### DO ✅
- Create fresh instances for each test
- Use `beforeEach()` for setup
- Clean up in `afterEach()` if needed
- Test one thing per test
- Use descriptive names

### DON'T ❌
- Depend on test execution order
- Reuse ledger/engine across tests
- Test multiple unrelated things
- Use magic numbers
- Leave debugging code

### Example

```typescript
// ❌ Bad: depends on order, reuses state
let ledger: Ledger;
describe('Ledger', () => {
  it('should init', () => {
    ledger = new Ledger();
  });
  it('should add', () => {
    ledger.applyBalanceChange(...); // Depends on first test
  });
});

// ✅ Good: isolated, clear setup
describe('Ledger', () => {
  let ledger: Ledger;
  
  beforeEach(() => {
    ledger = new Ledger();
  });
  
  it('should initialize empty', () => {
    expect(ledger.getAccountCount()).toBe(0);
  });
  
  it('should apply balance change', () => {
    ledger.applyBalanceChange(...);
    expect(ledger.getBalance(...)).toBe(expected);
  });
});
```

---

## Continuous Testing

For active development:

```bash
# Watch mode - re-run on file change
npm run test:watch

# Coverage in watch mode
npm run test:coverage:watch

# Combine all
npm run test:watch -- --coverage
```

---

## Troubleshooting

### Tests Won't Run
```bash
# Clear cache
rm -rf node_modules .vitest-cache
npm install
npm test
```

### Out of Memory
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=2048" npm test
```

### Module Resolution Error
```bash
# Ensure monorepo packages are built
npm run build:all
npm test
```

### Import Errors
```bash
# Verify @cavalre/floatlib-ts exists
ls floatlib-ts/dist/
npm test
```

---

## Test Metrics

Every release must maintain:
- ✅ 175+ test cases
- ✅ >90% code coverage
- ✅ Zero skipped tests
- ✅ <2 second runtime
- ✅ Zero flaky tests

Monitor in CI/CD dashboard.

---

**Questions about tests? Open an issue or email `hello@cavalierre.com`**
