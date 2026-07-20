# How to Use Sentinel (Complete Integration Guide)

This shows EXACTLY how to import and use each component.

---

## Installation First

```bash
npm install @cavalre/floatlib-ts
npm install @cavalre/ledger-ts
npm install @cavalre/risk-engine
```

---

## Part 1: FloatLib — Do Math Exactly

### Import It
```typescript
import * as FloatLib from '@cavalre/floatlib-ts';
```

### Convert Numbers to FloatFixed
```typescript
// USD amounts (usually 6 decimals)
const oneThousandUSD = FloatLib.toFloat(1000000000n, 6n);  // 1M cents = $1000

// ETH amounts (usually 18 decimals)
const oneETH = FloatLib.toFloat(1000000000000000000n, 18n);  // 1 ETH

// Percentages (2 decimals)
const fivePercent = FloatLib.toFloat(500n, 2n);  // 5.00%
```

### Do Math (Everything Returns Exact)
```typescript
const price = FloatLib.toFloat(50000n, 0n);      // $50k per coin
const quantity = FloatLib.toFloat(2n, 0n);       // 2 coins

// Multiply exactly
const total = FloatLib.times(price, quantity);   // Exactly $100k (no rounding)
console.log(FloatLib.toNumber(total));            // 100000

// Divide exactly
const half = FloatLib.divide(total, FloatLib.toFloat(2n, 0n));
console.log(FloatLib.toNumber(half));             // 50000 (exact)

// Add/subtract exactly
const withFee = FloatLib.plus(total, FloatLib.toFloat(250n, 0n));  // +$250
const afterFee = FloatLib.minus(withFee, FloatLib.toFloat(100n, 0n)); // -$100
```

### Compare Values (True/False)
```typescript
const balance = FloatLib.toFloat(1000n, 0n);
const needed = FloatLib.toFloat(500n, 0n);

if (FloatLib.isGT(balance, needed)) {
  console.log('You have enough!');  // True
}

if (FloatLib.isLEQ(needed, balance)) {
  console.log('Balance is sufficient');  // True
}

// Check if zero
if (FloatLib.isZero(balance)) {
  console.log('Empty!');  // False
}
```

### That's FloatLib!
Use it whenever you do money math. **Never use JavaScript `Number` type for money.**

---

## Part 2: Ledger — Track State & Detect Divergence

### Import It
```typescript
import { Ledger } from '@cavalre/ledger-ts';
import * as FloatLib from '@cavalre/floatlib-ts';
```

### Create a Ledger
```typescript
// Empty ledger
const ledger = new Ledger();

// OR with initial state
const ledger = new Ledger({
  version: 1n,
  accounts: {
    '0xMyAccount': {
      balances: {
        'USDC': FloatLib.toFloat(1000000n, 6n),  // $1M USDC
        'ETH': FloatLib.toFloat(100000000000000000n, 18n),  // 1 ETH
      },
      nonce: 0n,
      timestamp: 1000000n,
    },
  },
  blockNumber: 18000000n,
  blockTimestamp: 1000000n,
  divergenceDetected: false,
});
```

### Check Balances (Always Exact)
```typescript
// Get single balance
const usdcBalance = ledger.getBalance('0xMyAccount', 'USDC');
console.log('USDC:', FloatLib.toNumber(usdcBalance));  // 1000000

// Get all balances for account
const allBalances = ledger.getAccountBalances('0xMyAccount');
console.log('Balances:', allBalances);  // { USDC: ..., ETH: ... }

// Get total of one token across all accounts
const totalUSDC = ledger.getTotalBalance('USDC');
console.log('Total USDC:', FloatLib.toNumber(totalUSDC));
```

### Record Events from Blockchain
```typescript
// Deposit event
ledger.applyBalanceChange({
  account: '0xMyAccount',
  token: 'USDC',
  amount: FloatLib.toFloat(100000n, 6n),  // +$100k
  type: 'deposit',
  txHash: '0x123...',
  blockNumber: 18000001n,
});

// Withdrawal event
ledger.applyBalanceChange({
  account: '0xMyAccount',
  token: 'USDC',
  amount: FloatLib.toFloat(50000n, 6n),   // -$50k
  type: 'withdrawal',
  txHash: '0x456...',
  blockNumber: 18000002n,
});

console.log('New balance:', FloatLib.toNumber(
  ledger.getBalance('0xMyAccount', 'USDC')
));  // 1050000
```

### Record Transfers (Atomic)
```typescript
// Transfer from Alice to Bob
ledger.applySettlement({
  from: '0xAlice',
  to: '0xBob',
  token: 'USDC',
  amount: FloatLib.toFloat(10000n, 6n),  // $10k
  type: 'transfer',
  txHash: '0x789...',
  blockNumber: 18000003n,
});

// Now Alice has less, Bob has more
```

### **Critical: Check for Divergence**
```typescript
// Your cached balance
const cached = ledger.getBalance('0xMyAccount', 'USDC');

// Get balance from blockchain (use web3 provider)
const rpcBalance = await getRPCBalance('0xMyAccount', 'USDC');

// Compare
const diverged = ledger.checkDivergence('0xMyAccount', 'USDC', rpcBalance);

if (diverged) {
  console.error('🚨 STATE DIVERGED!');
  console.error('Cached:', FloatLib.toNumber(cached));
  console.error('RPC:', FloatLib.toNumber(rpcBalance));
  
  ledger.halt();  // STOP ALL TRADING
  
  // Don't trade until fixed
}
```

### Save & Restore State
```typescript
// Save state before doing something risky
const backup = ledger.snapshot();

// Do stuff...
ledger.applyBalanceChange(...);

// If it goes wrong, restore
ledger.restore(backup);

console.log('Rolled back to previous state');
```

### That's Ledger!
Use it to track all account balances and detect when your bot's view disagrees with the blockchain.

---

## Part 3: RiskEngine — Size Positions & Enforce Limits

### Import It
```typescript
import { RiskEngine } from '@cavalre/risk-engine';
import * as FloatLib from '@cavalre/floatlib-ts';
```

### Create Engine with Risk Config
```typescript
const engine = new RiskEngine({
  // Starting capital
  workingCapital: FloatLib.toFloat(1000n, 0n),  // $1,000 starting

  // Reserve requirement (keep 20% in cash)
  bufferPercent: FloatLib.toFloat(20n, 0n),

  // Position limits
  maxPositionSize: FloatLib.toFloat(50n, 0n),   // Max $50 per trade (5% of capital)
  maxLeverage: FloatLib.toFloat(2n, 0n),        // Max 2.0x leverage

  // Loss limits
  maxDailyLoss: FloatLib.toFloat(100n, 0n),     // Max $100 loss per day (10%)
  maxMonthlyLoss: FloatLib.toFloat(200n, 0n),   // Max $200 loss per month (20%)

  // Circuit breaker
  drawdownLimit: FloatLib.toFloat(15n, 0n),     // Stop if down 15% from peak
});
```

### Check Constraints Before Trading

#### 1. Can You Trade This Size?
```typescript
// You want to make $80 position
const wantSize = FloatLib.toFloat(80n, 0n);

// RiskEngine calculates what you're actually allowed
const allowedSize = engine.calculatePositionSize(wantSize);

console.log('Want:', FloatLib.toNumber(wantSize));    // 80
console.log('Allowed:', FloatLib.toNumber(allowedSize));  // 50 (capped at 5%)
```

#### 2. Is Leverage OK?
```typescript
const positionSize = FloatLib.toFloat(100n, 0n);   // Trying for $100
const currentEquity = FloatLib.toFloat(1000n, 0n);  // Have $1k

// Leverage = 100 / 1000 = 0.1x (well under 2.0x limit)
const leverageOK = engine.checkLeverage(positionSize, currentEquity);

if (leverageOK) {
  console.log('✅ Leverage OK');  // True
} else {
  console.log('❌ Would violate 2.0x max');  // False
}
```

#### 3. Would This Daily Loss Exceed Limit?
```typescript
const loss = FloatLib.toFloat(50n, 0n);  // Lost $50 on this trade

const dailyOK = engine.checkDailyLoss(loss);

if (dailyOK) {
  console.log('✅ Daily loss OK ($50 of $100 allowed)');
} else {
  console.log('❌ Would exceed daily $100 limit');
}
```

#### 4. Stop-Loss & Take-Profit
```typescript
const entryPrice = FloatLib.toFloat(50000n, 0n);    // Entered at $50k
const currentPrice = FloatLib.toFloat(49000n, 0n);  // Now $49k
const stopLoss = FloatLib.toFloat(48000n, 0n);      // Stop at $48k
const takeProfit = FloatLib.toFloat(55000n, 0n);    // Take profit at $55k

// Check conditions
const hitStopLoss = engine.checkStopLoss(entryPrice, stopLoss, currentPrice);
const hitTakeProfit = engine.checkTakeProfit(entryPrice, takeProfit, currentPrice);

if (hitStopLoss) {
  console.log('❌ Hit stop-loss! Sell now');  // True
}

if (hitTakeProfit) {
  console.log('✅ Hit take-profit! Sell now');  // False (price at $49k)
}
```

### Track Performance

#### Record Completed Trade
```typescript
engine.recordTrade({
  pnl: FloatLib.toFloat(30n, 0n),   // Made $30
  timestamp: Date.now(),
  symbol: 'BTC',
});

// Or a loss
engine.recordTrade({
  pnl: FloatLib.toFloat(-20n, 0n),  // Lost $20
  timestamp: Date.now(),
  symbol: 'ETH',
});
```

#### Update Equity (Mark-to-Market)
```typescript
// After trade closed or marking to current prices
const newEquity = FloatLib.toFloat(1030n, 0n);  // $1,030 (was $1,000)
engine.updateEquity(newEquity);

// Checks if peak equity updated, calculates drawdown
```

#### Get All Metrics
```typescript
const metrics = engine.getMetrics();

console.log('Equity:', FloatLib.toNumber(metrics.currentEquity));      // 1030
console.log('Peak:', FloatLib.toNumber(metrics.peakEquity));           // 1030
console.log('Drawdown:', FloatLib.toNumber(metrics.currentDrawdown));  // 0
console.log('Max DD ever:', FloatLib.toNumber(metrics.maxDrawdown));   // 0
console.log('Daily loss:', FloatLib.toNumber(metrics.dailyLoss));      // 0
console.log('Monthly loss:', FloatLib.toNumber(metrics.monthlyLoss));  // 0
console.log('Win rate:', (metrics.winRate * 100).toFixed(1) + '%');    // 100%
console.log('Total trades:', metrics.totalTrades);                     // 1
```

#### Check Circuit Breaker
```typescript
// Equity dropped to $850 (15% down from $1000 peak)
engine.updateEquity(FloatLib.toFloat(850n, 0n));

const circuitTripped = engine.isDrawdownExceeded();

if (circuitTripped) {
  console.log('🚨 CIRCUIT BREAKER TRIPPED!');
  console.log('Stop trading until equity recovered');
}
```

### That's RiskEngine!
Use it to:
- Calculate safe position sizes
- Enforce leverage limits
- Track daily/monthly losses
- Implement take-profit and stop-loss
- Monitor drawdown and trigger circuit breaker

---

## Putting It All Together: Real Bot

```typescript
import * as FloatLib from '@cavalre/floatlib-ts';
import { Ledger } from '@cavalre/ledger-ts';
import { RiskEngine } from '@cavalre/risk-engine';

async function myTradingBot() {
  // Setup
  const ledger = new Ledger();
  const engine = new RiskEngine({
    workingCapital: FloatLib.toFloat(1000n, 0n),
    maxPositionSize: FloatLib.toFloat(50n, 0n),
    maxLeverage: FloatLib.toFloat(2n, 0n),
    maxDailyLoss: FloatLib.toFloat(100n, 0n),
    maxMonthlyLoss: FloatLib.toFloat(200n, 0n),
    drawdownLimit: FloatLib.toFloat(15n, 0n),
    bufferPercent: FloatLib.toFloat(20n, 0n),
  });

  // Main loop
  while (true) {
    // 1. Check state hasn't diverged
    const myBalance = ledger.getBalance('0xMe', 'USDC');
    const rpcBalance = await getRPC().getBalance('0xMe', 'USDC');
    
    if (ledger.checkDivergence('0xMe', 'USDC', rpcBalance)) {
      console.log('State diverged, halting');
      break;
    }

    // 2. Get market signal
    const btcPrice = await getMarketData('BTC');
    const signal = calculateTradingSignal(btcPrice);  // -1, 0, or 1

    if (signal === 0) continue;  // No signal

    // 3. Size position safely
    const profitSoFar = FloatLib.toFloat(50n, 0n);  // Up $50
    const positionSize = engine.calculatePositionSize(profitSoFar);

    console.log('Signal:', signal, 'Position size:', FloatLib.toNumber(positionSize));

    // 4. Check leverage
    const currentEquity = engine.getCurrentEquity();
    if (!engine.checkLeverage(positionSize, currentEquity)) {
      console.log('Would exceed leverage, skipping');
      continue;
    }

    // 5. Place order
    const order = await placeOrder({
      symbol: 'BTC',
      side: signal > 0 ? 'buy' : 'sell',
      size: FloatLib.toNumber(positionSize),
    });

    console.log('Order placed:', order.id);

    // 6. Wait for close
    const closePrice = await waitForClose(order.id);

    // 7. Calculate P&L (exact)
    const entryValue = FloatLib.times(btcPrice, positionSize);
    const exitValue = FloatLib.times(closePrice, positionSize);
    const pnl = FloatLib.minus(exitValue, entryValue);

    console.log('P&L:', FloatLib.toNumber(pnl));

    // 8. Record & update
    engine.recordTrade({
      pnl,
      timestamp: Date.now(),
      symbol: 'BTC',
    });

    const newEquity = FloatLib.plus(currentEquity, pnl);
    engine.updateEquity(newEquity);

    // 9. Check circuit breaker
    if (engine.isDrawdownExceeded()) {
      console.log('Drawdown exceeded, stopping');
      break;
    }

    // 10. Check daily loss limit
    if (!engine.checkDailyLoss(FloatLib.ZERO)) {
      console.log('Daily loss limit reached');
      break;
    }
  }
}

myTradingBot().catch(console.error);
```

---

## Summary

| Component | What It Does | How to Use |
|-----------|------------|-----------|
| **FloatLib** | Exact math | `FloatLib.times()`, `FloatLib.divide()`, etc. |
| **Ledger** | Track state | `ledger.applyBalanceChange()`, `ledger.checkDivergence()` |
| **RiskEngine** | Enforce limits | `engine.calculatePositionSize()`, `engine.checkLeverage()` |

That's it! Three components, all imported and used exactly as shown above.

---

**Now you know exactly how to use Sentinel.** Pick what you need and integrate it.

Questions? Email hello@cavalierre.com
