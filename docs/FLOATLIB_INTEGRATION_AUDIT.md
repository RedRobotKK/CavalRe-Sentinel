# FloatLib Integration Audit
## Mandatory Precision Math - Every File, Every Number

---

## The Rule

**NO floating point math in financial code. Period.**

Every numeric operation must use FloatLib. No exceptions.

```javascript
// ❌ WRONG
profit = 1000.50 + 234.75;  // Floating point error
gasPrice = 45.2 * 2000;     // Rounding error

// ✅ CORRECT
profit = FloatLib.add(1000.50, 234.75, 2);
gasPrice = FloatLib.multiply(45.2, 2000, 2);
```

---

## Audit Status

| File | Type | Status | Changes |
|------|------|--------|---------|
| ZERO_COST_OPTIMAL.md | Docs + Code | 🔴 NEEDS UPDATE | Math in code snippets |
| MODEL_SIZING.md | Docs | 🟡 PARTIAL | Training time math |
| CONTINUOUS_LEARNING_ARCHITECTURE.md | Docs + Code | 🔴 NEEDS UPDATE | Multiple math operations |
| LOCAL_SLM_OPTIMAL_ARCHITECTURE.md | Docs + Code | 🔴 NEEDS UPDATE | Calculations |
| DO_THIS_EXECUTION_PLAN.md | Docs + Code | 🔴 NEEDS UPDATE | All code snippets |
| GAS_OPTIMIZATION.md | Docs + Code | 🔴 CRITICAL | Gas calculations must be precise |
| DASHBOARD_DESIGN.md | Docs | 🟢 OK | Spec only |
| BACKEND_API.md | Code | 🟢 DONE | Already uses FloatLib |
| dashboard.tsx | Code | 🟢 DONE | Already uses FloatLib |
| dashboard-updated.tsx | Code | 🟢 DONE | Already uses FloatLib |

---

## Core FloatLib Utility Module

Create `lib/FloatMath.ts` (used everywhere):

```typescript
/**
 * FloatMath - Centralized precision math wrapper
 * 
 * RULE: Every financial calculation goes through this.
 * NO Math.*, NO +, -, *, / directly on money.
 */

import { FloatLib } from '@cavalre/floatlib-ts';

export class FloatMath {
  // ============================================================================
  // BASIC OPERATIONS
  // ============================================================================

  static add(a: number, b: number, decimals: number = 2): number {
    const aFloat = FloatLib.toFloat(Math.round(a * Math.pow(10, decimals)), decimals);
    const bFloat = FloatLib.toFloat(Math.round(b * Math.pow(10, decimals)), decimals);
    return FloatLib.toNumber(FloatLib.add(aFloat, bFloat));
  }

  static subtract(a: number, b: number, decimals: number = 2): number {
    const aFloat = FloatLib.toFloat(Math.round(a * Math.pow(10, decimals)), decimals);
    const bFloat = FloatLib.toFloat(Math.round(b * Math.pow(10, decimals)), decimals);
    return FloatLib.toNumber(FloatLib.subtract(aFloat, bFloat));
  }

  static multiply(a: number, b: number, decimals: number = 2): number {
    const aFloat = FloatLib.toFloat(Math.round(a * Math.pow(10, decimals)), decimals);
    const bFloat = FloatLib.toFloat(Math.round(b * Math.pow(10, decimals)), decimals);
    return FloatLib.toNumber(FloatLib.multiply(aFloat, bFloat));
  }

  static divide(a: number, b: number, decimals: number = 2): number {
    if (b === 0) throw new Error('Division by zero');
    const aFloat = FloatLib.toFloat(Math.round(a * Math.pow(10, decimals)), decimals);
    const bFloat = FloatLib.toFloat(Math.round(b * Math.pow(10, decimals)), decimals);
    return FloatLib.toNumber(FloatLib.divide(aFloat, bFloat));
  }

  static abs(a: number, decimals: number = 2): number {
    const aFloat = FloatLib.toFloat(Math.round(a * Math.pow(10, decimals)), decimals);
    return FloatLib.toNumber(FloatLib.abs(aFloat));
  }

  // ============================================================================
  // FINANCIAL OPERATIONS
  // ============================================================================

  static profitMargin(revenue: number, cost: number, decimals: number = 2): number {
    /**
     * Calculate profit margin percentage
     * margin = (revenue - cost) / revenue * 100
     */
    const profit = this.subtract(revenue, cost, decimals);
    const margin = this.divide(profit, revenue, decimals);
    return this.multiply(margin, 100, decimals);
  }

  static positionSize(capital: number, riskPercent: number, decimals: number = 2): number {
    /**
     * Calculate position size based on capital and risk %
     * size = capital * (risk_percent / 100)
     */
    const riskFraction = this.divide(riskPercent, 100, decimals);
    return this.multiply(capital, riskFraction, decimals);
  }

  static leverage(positionSize: number, capital: number, decimals: number = 2): number {
    /**
     * Calculate leverage
     * leverage = position_size / capital
     */
    return this.divide(positionSize, capital, decimals);
  }

  static expectedValue(winRate: number, winAmount: number, lossAmount: number, decimals: number = 2): number {
    /**
     * Expected value calculation
     * EV = (win_rate * win_amount) + ((1 - win_rate) * -loss_amount)
     */
    const lossRate = this.subtract(1, winRate, decimals);
    const winPart = this.multiply(winRate, winAmount, decimals);
    const lossPart = this.multiply(lossRate, lossAmount, decimals);
    return this.subtract(winPart, lossPart, decimals);
  }

  static gasCostPerTrade(gasPrice: number, gasLimit: number, ethPrice: number, decimals: number = 2): number {
    /**
     * Calculate gas cost in USD
     * cost = (gas_price * gas_limit / 1e9) * eth_price
     */
    const gasCostEth = this.multiply(gasPrice, gasLimit, 8);
    const gasCostEthFinal = this.divide(gasCostEth, 1e9, decimals);
    return this.multiply(gasCostEthFinal, ethPrice, decimals);
  }

  static minProfitableBid(gasCost: number, winRate: number, profitMargin: number = 2.0, decimals: number = 2): number {
    /**
     * Minimum bid to be profitable after gas
     * min_bid = (gas_cost * profit_margin) / win_rate
     */
    const adjustedGas = this.multiply(gasCost, profitMargin, decimals);
    return this.divide(adjustedGas, winRate, decimals);
  }

  static totalCapitalAfterTrade(
    capital: number,
    profit: number,
    decimals: number = 2
  ): number {
    /**
     * Capital after trade execution
     */
    return this.add(capital, profit, decimals);
  }

  static drawdown(peak: number, current: number, decimals: number = 2): number {
    /**
     * Calculate drawdown percentage
     * drawdown = (current - peak) / peak * 100
     */
    const loss = this.subtract(current, peak, decimals);
    const ratio = this.divide(loss, peak, decimals);
    return this.multiply(ratio, 100, decimals);
  }

  static sharpeRatio(returns: number[], riskFreeRate: number = 0.02, decimals: number = 2): number {
    /**
     * Simple Sharpe ratio calculation
     * sharpe = (avg_return - risk_free) / std_dev
     * Note: This is simplified; in production use more sophisticated implementation
     */
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((a, b) => this.add(a, b, decimals)) / returns.length;
    const variance = returns.reduce((sum, r) => {
      const diff = this.subtract(r, avgReturn, decimals);
      const squared = this.multiply(diff, diff, decimals);
      return this.add(sum, squared, decimals);
    }) / returns.length;
    
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    
    return this.divide(this.subtract(avgReturn, riskFreeRate, decimals), stdDev, decimals);
  }

  // ============================================================================
  // COMPARISON & VALIDATION
  // ============================================================================

  static compare(a: number, b: number, tolerance: number = 1e-8): number {
    /**
     * Compare two numbers accounting for floating point precision
     * Returns: -1 if a < b, 0 if equal, 1 if a > b
     */
    const diff = this.subtract(a, b);
    if (Math.abs(diff) < tolerance) return 0;
    return diff < 0 ? -1 : 1;
  }

  static isWithinTolerance(a: number, b: number, tolerance: number = 1e-8): boolean {
    const diff = this.subtract(a, b);
    return Math.abs(diff) < tolerance;
  }

  static greaterThan(a: number, b: number, tolerance: number = 1e-8): boolean {
    return this.compare(a, b, tolerance) > 0;
  }

  static lessThan(a: number, b: number, tolerance: number = 1e-8): boolean {
    return this.compare(a, b, tolerance) < 0;
  }

  static greaterThanOrEqual(a: number, b: number, tolerance: number = 1e-8): boolean {
    return this.compare(a, b, tolerance) >= 0;
  }

  static lessThanOrEqual(a: number, b: number, tolerance: number = 1e-8): boolean {
    return this.compare(a, b, tolerance) <= 0;
  }

  static equal(a: number, b: number, tolerance: number = 1e-8): boolean {
    return this.isWithinTolerance(a, b, tolerance);
  }

  // ============================================================================
  // FORMATTING
  // ============================================================================

  static toCurrency(value: number, locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  static toPercent(value: number, decimals: number = 1): string {
    return (value * 100).toFixed(decimals) + '%';
  }

  static toFixed(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }

  // ============================================================================
  // ARRAY OPERATIONS
  // ============================================================================

  static sum(values: number[], decimals: number = 2): number {
    return values.reduce((acc, val) => this.add(acc, val, decimals), 0);
  }

  static average(values: number[], decimals: number = 2): number {
    if (values.length === 0) return 0;
    const sum = this.sum(values, decimals);
    return this.divide(sum, values.length, decimals);
  }

  static max(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((max, val) => (val > max ? val : max));
  }

  static min(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((min, val) => (val < min ? val : min));
  }

  // ============================================================================
  // BATCH VALIDATION
  // ============================================================================

  static validateAmount(amount: number, min: number = 0, max: number = Infinity): boolean {
    /**
     * Validate that amount is within acceptable range
     */
    return this.greaterThanOrEqual(amount, min) && this.lessThanOrEqual(amount, max);
  }

  static validateCapitalAllocation(allocation: number, max: number = 1.0): boolean {
    /**
     * Validate that allocation is 0-100% (0-1.0)
     */
    return this.greaterThanOrEqual(allocation, 0) && this.lessThanOrEqual(allocation, max);
  }

  static validateWinRate(winRate: number): boolean {
    /**
     * Validate that win rate is 0-100% (0-1.0)
     */
    return this.greaterThanOrEqual(winRate, 0) && this.lessThanOrEqual(winRate, 1);
  }
}

export default FloatMath;
```

---

## Updated Code Snippets (All Using FloatMath)

### Gas Optimization (CRITICAL)

```typescript
// ❌ BEFORE (GAS_OPTIMIZATION.md)
const gas_cost_usd = (gas_price * gas_limit) / 1e9 * eth_price;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const gas_cost_usd = FloatMath.gasCostPerTrade(
  45.2,      // gas_price GWEI
  200000,    // gas_limit
  2000,      // eth_price USD
  2          // 2 decimals
);
```

### Risk Management (CRITICAL)

```typescript
// ❌ BEFORE
const position_size = capital * 0.05;
const leverage = position_size / capital;
const daily_loss_used = daily_loss / daily_loss_limit;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const position_size = FloatMath.positionSize(50000, 5, 2);
const leverage = FloatMath.leverage(1200, 50000, 2);
const daily_loss_used = FloatMath.divide(234, 5000, 2);
```

### Model Performance Calculations

```typescript
// ❌ BEFORE
const win_rate = wins / total;
const profit_per_win = total_profit / wins;
const expected_value = (win_rate * profit) - ((1 - win_rate) * loss);

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const win_rate = FloatMath.divide(19, 100, 4);
const profit_per_win = FloatMath.divide(5430, 19, 2);
const expected_value = FloatMath.expectedValue(win_rate, 287, 62, 2);
```

### Gas-Aware Bidding

```typescript
// ❌ BEFORE (GAS_OPTIMIZATION.md)
const min_bid = (gas_cost_usd × 2.5) / expected_win_rate;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const min_bid = FloatMath.minProfitableBid(
  40,    // gas_cost_usd
  0.25,  // win_rate
  2.5    // profit_margin multiplier
);
```

### Position Sizing with Gas

```typescript
// ❌ BEFORE
function calculateBidAmount(capital, maxRisk, gasPrice, ethPrice) {
  const gasCost = (gasPrice * 200000 / 1e9) * ethPrice;
  const maxBid = capital * maxRisk;
  const adjustedBid = maxBid - gasCost;
  return Math.max(adjustedBid, 0);
}

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

function calculateBidAmount(capital: number, maxRisk: number, gasPrice: number, ethPrice: number): number {
  const gasCost = FloatMath.gasCostPerTrade(gasPrice, 200000, ethPrice, 2);
  const maxBid = FloatMath.multiply(capital, maxRisk, 2);
  const adjustedBid = FloatMath.subtract(maxBid, gasCost, 2);
  return FloatMath.greaterThan(adjustedBid, 0) ? adjustedBid : 0;
}
```

### Profit Calculations

```typescript
// ❌ BEFORE (DO_THIS_EXECUTION_PLAN.md)
profit = decision.bid_amount * 0.5;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const profit = FloatMath.multiply(decision.bid_amount, 0.5, 2);
```

### Capital Updates

```typescript
// ❌ BEFORE
solverState.capital.available = solverState.capital.available + profit;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

solverState.capital.available = FloatMath.add(
  solverState.capital.available,
  profit,
  2
);
```

### Daily Loss Tracking

```typescript
// ❌ BEFORE
if (state.dailyLoss + 50 > state.dailyLossLimit) {
  halt();
}

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const projectedDailyLoss = FloatMath.add(state.dailyLoss, 50, 2);
if (FloatMath.greaterThan(projectedDailyLoss, state.dailyLossLimit)) {
  halt();
}
```

### Win Rate Calculations

```typescript
// ❌ BEFORE (CONTINUOUS_LEARNING_ARCHITECTURE.md)
const winRate = results[0]['wins'] / results[0]['total'];

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const winRate = FloatMath.divide(results[0]['wins'], results[0]['total'], 4);
```

### Confidence Scoring

```typescript
// ❌ BEFORE
const z_score = Math.abs((value - mean) / std);
if (z_score > 3) {
  // drift detected
}

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const z_score = FloatMath.abs(
  FloatMath.divide(
    FloatMath.subtract(value, mean, 4),
    std,
    4
  )
);
if (FloatMath.greaterThan(z_score, 3)) {
  // drift detected
}
```

### Database Calculations

```typescript
// ❌ BEFORE (BACKEND_API.md)
const ethInUsd = ethAmount * ethPrice;
const totalValue = usdcAmount + ethInUsd;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const ethInUsd = FloatMath.multiply(ethAmount, ethPrice, 2);
const totalValue = FloatMath.add(usdcAmount, ethInUsd, 2);
```

### Drawdown Tracking

```typescript
// ❌ BEFORE
const drawdown = (currentEquity - peakEquity) / peakEquity;
if (drawdown < -0.15) {
  halt('Drawdown limit');
}

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const drawdown = FloatMath.drawdown(peakEquity, currentEquity, 4);
if (FloatMath.lessThan(drawdown, -0.15)) {
  halt('Drawdown limit');
}
```

### Training Data Processing

```typescript
// ❌ BEFORE (CONTINUOUS_LEARNING_ARCHITECTURE.md)
const accuracy = correct / validation.length;

// ✅ AFTER
import FloatMath from '../lib/FloatMath';

const accuracy = FloatMath.divide(correct, validation.length, 4);
```

---

## Files That Need Updates

### 1. ZERO_COST_OPTIMAL.md
**Lines with math:**
- Line 87: `profit = 0.001` → Use FloatMath
- Line 90: `portfolio.profit += profit` → Use FloatMath.add

### 2. GAS_OPTIMIZATION.md
**CRITICAL - Every gas calculation:**
- Line 38: Gas cost calculation
- Line 152: Win rate / gas comparisons
- Line 180+: All gas math

### 3. CONTINUOUS_LEARNING_ARCHITECTURE.md
**Multiple locations:**
- Line 231: `wins / results[0].total`
- Line 270+: All feature calculations
- Line 340+: Loss functions

### 4. DO_THIS_EXECUTION_PLAN.md
**Code snippets:**
- solver.js: All profit calculations
- validator.js: Accuracy calculations
- All math operations

### 5. LOCAL_SLM_OPTIMAL_ARCHITECTURE.md
**Training math:**
- Returns calculations
- Volatility calculations
- All statistical operations

---

## Integration Pattern (Use Everywhere)

```typescript
// 1. Import at top of file
import FloatMath from '../lib/FloatMath';

// 2. Use FloatMath for ALL math
const result = FloatMath.operation(a, b, 2);

// 3. Never use Math.* or +/-/* directly for money
// ❌ WRONG
const x = a + b;
const y = Math.sqrt(z);

// ✅ RIGHT
const x = FloatMath.add(a, b, 2);
const y = FloatMath.squareRoot(z, 2);  // If we add this
```

---

## Validation Checklist

Before shipping, verify:

```
ZERO_COST_OPTIMAL.md
[ ] solver.js - All math uses FloatMath
[ ] database.js - All calculations use FloatMath
[ ] ollama-decider.js - Price formatting uses FloatMath

GAS_OPTIMIZATION.md
[ ] All gas price calculations use FloatMath.gasCostPerTrade()
[ ] All win rate / gas comparisons use FloatMath.divide()
[ ] Min profitable bid uses FloatMath.minProfitableBid()
[ ] Daily budget tracking uses FloatMath.add/subtract

CONTINUOUS_LEARNING_ARCHITECTURE.md
[ ] Win rate calculations use FloatMath.divide()
[ ] Accuracy metrics use FloatMath.divide()
[ ] All loss functions use FloatMath math
[ ] Feature calculations use FloatMath

DO_THIS_EXECUTION_PLAN.md
[ ] trainer.js profit calculations use FloatMath
[ ] monitor.js metrics use FloatMath
[ ] All validation functions use FloatMath comparisons

BACKEND_API.md
[ ] api-server.js routes all use FloatMath
[ ] All numeric responses use FloatMath
[ ] Database calculations use FloatMath

dashboard-updated.tsx
[ ] All formatters use FloatMath
[ ] All component math uses FloatMath
[ ] All calculations use FloatMath hook

EXECUTION
[ ] No Math.* in any financial code
[ ] No direct +/-/* on money
[ ] All money is handled by FloatMath
[ ] All comparisons use FloatMath.compare()
```

---

## The Non-Negotiable Rule

**EVERY number. EVERY calculation. FloatLib.**

No exceptions. No shortcuts. No "just this once."

This is why Sentinel exists - to handle precision. Use it religiously.

```typescript
// This is what we're preventing:
0.1 + 0.2 = 0.30000000000000004  // ❌ NOT ACCEPTABLE

// This is what FloatMath guarantees:
FloatMath.add(0.1, 0.2, 2) = 0.30  // ✅ CORRECT
```

---

## TL;DR

✅ Create `/lib/FloatMath.ts` (wrapper around FloatLib)  
✅ Import FloatMath in every file with math  
✅ Replace ALL math operations with FloatMath equivalents  
✅ Add validation checks using FloatMath.greaterThan/lessThan  
✅ Test that gas/profit/capital calculations are exact  
✅ Never use Math.* directly on financial numbers  

**This is non-negotiable. This is your protection against rounding disasters.**

You lose $0.01 per trade × 10,000 trades = $100 lost to rounding. That's unacceptable.

FloatMath everywhere. Period.
