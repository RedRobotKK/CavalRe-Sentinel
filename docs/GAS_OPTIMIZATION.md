# Gas Management & Optimization
## Critical for Profitability

---

## The Gas Problem

**Reality:** Gas costs kill small bids

```
Bid amount: $300
Gas cost at 50 GWEI: $25-50
Profit after gas: $300 * 0.5 profit - $40 gas = $110 profit

But if you lose the bid:
Loss: -$40 (gas only, no upside)

Win rate needs to be HIGH to offset gas.
With 25% win rate: 25% * $300 profit - 75% * $40 loss = $45 avg profit

Math breaks below ~$500 bid amount
```

---

## Solution: Gas-Aware Decision Making

### 1. Real-time Gas Monitoring

```python
"""
Fetch current gas prices and factor into every decision
"""

class GasMonitor:
    def __init__(self, rpc_url):
        self.rpc = rpc_url
        self.min_profitable_bid = 500  # Below this, skip
    
    async def get_gas_price(self):
        """
        Get current gas price in GWEI
        """
        response = await self.rpc.call({
            'method': 'eth_gasPrice',
            'params': []
        })
        
        gas_price_wei = int(response, 16)
        gas_price_gwei = gas_price_wei / 1e9
        
        return gas_price_gwei
    
    async def estimate_tx_cost_usd(self, gas_limit: int = 200000):
        """
        Estimate transaction cost in USD
        """
        gas_price = await self.get_gas_price()
        eth_price = await self.get_eth_price()
        
        # Gas cost in ETH
        gas_cost_eth = (gas_price * gas_limit) / 1e9
        
        # Convert to USD
        gas_cost_usd = gas_cost_eth * eth_price
        
        return gas_cost_usd
    
    async def get_min_profitable_bid(self):
        """
        Don't bid if profit < 2x gas cost
        """
        gas_cost = await self.estimate_tx_cost_usd()
        min_profit = gas_cost * 2
        
        return min_profit
```

### 2. Gas-Aware Bid Sizing

```python
"""
Only bid if profit expectation > gas costs
"""

class GasAwareBidder:
    def __init__(self, gas_monitor):
        self.gas_monitor = gas_monitor
        self.min_profit_margin = 2.0  # Must be 2x gas cost
    
    async def should_bid(self, intent, model_decision):
        """
        Model says BID, but check gas first
        """
        
        # Get current gas cost
        gas_cost = await self.gas_monitor.estimate_tx_cost_usd()
        
        # Model's expected profit
        expected_profit = model_decision.bid_amount * 0.5  # Rough estimate
        
        # Check if profitable after gas
        profit_after_gas = expected_profit - gas_cost
        
        if profit_after_gas < gas_cost * self.min_profit_margin:
            # Skip - not worth the risk
            return {
                'should_bid': False,
                'reason': f'Expected profit ${expected_profit:.0f} < gas cost ${gas_cost:.0f}',
                'gas_cost': gas_cost,
            }
        
        return {
            'should_bid': True,
            'bid_amount': model_decision.bid_amount,
            'expected_profit_after_gas': profit_after_gas,
            'gas_cost': gas_cost,
        }

class RiskManagerWithGas:
    """
    Sentinel + Gas awareness combined
    """
    
    def __init__(self, capital: float, gas_monitor):
        self.capital = capital
        self.gas_monitor = gas_monitor
        self.daily_loss_limit = capital * 0.10
        self.position_limit = capital * 0.05
    
    async def execute_decision(self, decision, intent):
        """
        Check both risk limits AND gas costs
        """
        
        # Check 1: Basic risk limits
        if decision['bid_amount'] > self.position_limit:
            return {'status': 'REJECTED', 'reason': 'Exceeds position limit'}
        
        # Check 2: Gas cost
        gas_cost = decision.get('gas_cost', 0)
        profit_after_gas = decision.get('expected_profit_after_gas', 0)
        
        if profit_after_gas < 0:
            return {
                'status': 'REJECTED',
                'reason': f'Unprofitable after gas: ${profit_after_gas:.0f}'
            }
        
        # Check 3: Daily loss buffer (gas is a loss even if bid lost)
        if gas_cost > (self.daily_loss_limit - self.current_daily_loss):
            return {
                'status': 'REJECTED',
                'reason': 'Not enough daily loss budget for gas'
            }
        
        # Check 4: Win rate threshold
        # Only bid if win rate high enough to justify gas
        win_rate = decision.get('model_confidence', 0)
        min_win_rate_for_gas = gas_cost / (gas_cost + decision['bid_amount'])
        
        if win_rate < min_win_rate_for_gas:
            return {
                'status': 'REJECTED',
                'reason': f'Win rate {win_rate:.1%} below minimum {min_win_rate_for_gas:.1%}'
            }
        
        # All checks passed
        return {
            'status': 'APPROVED',
            'bid_amount': decision['bid_amount'],
            'gas_cost': gas_cost,
            'expected_profit': profit_after_gas,
        }
```

---

## Dashboard Gas Metrics

Add to dashboard display:

```javascript
const GasMetricsCard: React.FC = () => {
  const [gasMetrics, setGasMetrics] = useState({
    currentGasPrice: 45,
    estTransactionCost: 42.50,
    gasUsedToday: 340,
    minProfitableBid: 520,
    gasRatio: 0.034,  // Gas / profit
  });

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>⛽ GAS METRICS</h3>
      
      <div style={styles.metric}>
        <span style={styles.label}>Gas Price</span>
        <span style={styles.value}>{gasMetrics.currentGasPrice} GWEI</span>
      </div>
      
      <div style={styles.metric}>
        <span style={styles.label}>Est. Transaction Cost</span>
        <span style={styles.value}>${gasMetrics.estTransactionCost.toFixed(2)}</span>
      </div>
      
      <div style={styles.metric}>
        <span style={styles.label}>Daily Gas Used</span>
        <span style={styles.value}>${gasMetrics.gasUsedToday.toFixed(2)}</span>
      </div>
      
      <div style={styles.metric}>
        <span style={styles.label}>Min Profitable Bid</span>
        <span style={{
          ...styles.value,
          color: gasMetrics.minProfitableBid > 500 ? '#ff0000' : '#00ff00'
        }}>
          ${gasMetrics.minProfitableBid.toFixed(0)}
        </span>
      </div>
      
      <div style={styles.metric}>
        <span style={styles.label}>Gas / Profit Ratio</span>
        <span style={{
          ...styles.value,
          color: gasMetrics.gasRatio < 0.05 ? '#00ff00' : '#fbbf24'
        }}>
          {(gasMetrics.gasRatio * 100).toFixed(1)}%
        </span>
      </div>
      
      {/* Alert if gas too high */}
      {gasMetrics.currentGasPrice > 60 && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: '#3a1a1a',
          border: '1px solid #ff0000',
          borderRadius: '4px',
          color: '#ff0000',
          fontSize: '12px',
        }}>
          ⚠️ High gas price. Increase min profitable bid or reduce volume.
        </div>
      )}
    </div>
  );
};
```

---

## Gas Optimization Strategies

### Strategy 1: Time Arbitrage

```python
"""
Wait for gas to be low before bidding aggressively
"""

class GasTimingOptimizer:
    def __init__(self, gas_monitor):
        self.gas_monitor = gas_monitor
        self.low_gas_threshold = 35  # GWEI
        self.high_gas_threshold = 60  # GWEI
    
    async def get_bid_multiplier(self):
        """
        Scale bid amount based on gas price
        """
        gas_price = await self.gas_monitor.get_gas_price()
        
        if gas_price < self.low_gas_threshold:
            # Low gas = bid aggressively
            return 1.5  # Bid 50% more
        elif gas_price > self.high_gas_threshold:
            # High gas = bid conservatively
            return 0.5  # Bid 50% less
        else:
            # Normal conditions
            return 1.0
    
    async def should_pause_bidding(self):
        """
        Stop bidding if gas is insane
        """
        gas_price = await self.gas_monitor.get_gas_price()
        return gas_price > 100  # Pause if > 100 GWEI
```

### Strategy 2: Batch Processing

```python
"""
Group multiple bids together to amortize gas
"""

class BatchBidder:
    def __init__(self, batch_size: int = 10):
        self.batch_size = batch_size
        self.pending_bids = []
    
    async def add_bid(self, bid):
        """
        Queue bid instead of executing immediately
        """
        self.pending_bids.append(bid)
        
        if len(self.pending_bids) >= self.batch_size:
            await self.execute_batch()
    
    async def execute_batch(self):
        """
        Submit all pending bids in one transaction
        
        Gas cost split across 10 bids = 10x cheaper per bid
        """
        if not self.pending_bids:
            return
        
        # Group into single CoW batch
        total_profit = sum(b['profit'] for b in self.pending_bids)
        gas_cost = await self.estimate_batch_gas_cost()
        
        profit_per_bid = total_profit / len(self.pending_bids) - (gas_cost / len(self.pending_bids))
        
        print(f'Executing batch: {len(self.pending_bids)} bids')
        print(f'Profit per bid: ${profit_per_bid:.0f}')
        
        self.pending_bids = []
```

### Strategy 3: Liquidity Pool Optimization

```python
"""
Use lower-cost DEXs when gas is high
"""

class DEXRouter:
    def __init__(self):
        self.dex_gas_costs = {
            'uniswap_v3': 150000,    # High precision, high gas
            'uniswap_v2': 100000,    # Simpler, lower gas
            'curve': 80000,          # Stablecoin optimized
            '1inch': 120000,         # Aggregator
        }
    
    async def choose_dex(self, gas_price: float, token_in: str, token_out: str):
        """
        Choose DEX that minimizes gas cost
        """
        
        if gas_price > 60:
            # High gas - use cheapest DEX
            return 'curve'  # Lowest gas
        elif gas_price > 45:
            # Medium gas - use Uniswap V2
            return 'uniswap_v2'
        else:
            # Low gas - use best liquidity
            return 'uniswap_v3'
```

---

## Daily Gas Budget

Track gas spending like capital:

```python
class DailyGasBudget:
    def __init__(self, daily_limit_usd: float = 500):
        self.daily_limit = daily_limit_usd
        self.daily_spent = 0
        self.reset_at = datetime.now().replace(hour=0, minute=0, second=0) + timedelta(days=1)
    
    def check_budget(self, estimated_gas_cost: float):
        """
        Can we afford this transaction's gas?
        """
        
        # Reset if new day
        if datetime.now() > self.reset_at:
            self.daily_spent = 0
            self.reset_at = datetime.now().replace(hour=0, minute=0, second=0) + timedelta(days=1)
        
        # Check budget
        remaining = self.daily_limit - self.daily_spent
        
        if estimated_gas_cost > remaining:
            return False, f'Gas budget exhausted: ${remaining:.2f} remaining'
        
        return True, remaining - estimated_gas_cost
    
    def record_gas_spend(self, actual_gas_cost: float):
        """
        Log actual gas spent (after transaction confirms)
        """
        self.daily_spent += actual_gas_cost
        print(f'Gas spent: ${actual_gas_cost:.2f} (Total today: ${self.daily_spent:.2f})')
```

---

## Gas Dashboard Alerts

```javascript
const GasAlerts: React.FC = () => {
  const alerts = [
    {
      level: 'WARNING',
      message: 'Gas price >60 GWEI: Reducing bid volume by 50%',
      color: '#fbbf24',
    },
    {
      level: 'CRITICAL',
      message: 'Daily gas budget 92% used: Pausing non-critical trades',
      color: '#ff0000',
    },
    {
      level: 'INFO',
      message: 'Low gas price detected: Increasing bid aggressiveness',
      color: '#00ffff',
    },
  ];

  return (
    <div style={{...styles.card, gridColumn: '1 / -1'}}>
      <h3 style={styles.cardTitle}>⚠️ GAS ALERTS</h3>
      {alerts.map((alert, i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px',
            marginBottom: '8px',
            background: 'rgba(0,0,0,0.3)',
            borderLeft: `3px solid ${alert.color}`,
            color: alert.color,
            fontSize: '12px',
            borderRadius: '4px',
          }}
        >
          <strong>[{alert.level}]</strong> {alert.message}
        </div>
      ))}
    </div>
  );
};
```

---

## The Gas Formula

**Minimum Profitable Bid:**

```
min_bid = (gas_cost_usd × 2.5) / expected_win_rate

Example:
- Gas cost: $40
- Win rate: 25%
- Min bid = ($40 × 2.5) / 0.25 = $400

If bid amount < $400 with 25% win rate:
Expected value = $400 × 0.25 profit × 0.25 = $25
Expected gas loss = $400 × 0.75 × $40 = $12,000 (LOSS)

So we skip bids < $400 when gas = $40/tx
```

---

## Integration Into Solver

```python
# In solver.js or solver.py

class GasAwareSolver:
    def __init__(self, gas_monitor, risk_manager):
        self.gas_monitor = gas_monitor
        self.risk_manager = risk_manager
    
    async def process_intent(self, intent):
        # 1. Model decision
        model_decision = await self.model.decide(intent)
        
        # 2. Add gas context
        gas_cost = await self.gas_monitor.estimate_tx_cost_usd()
        min_profitable_bid = await self.gas_monitor.get_min_profitable_bid()
        
        decision_with_gas = {
            **model_decision,
            'gas_cost': gas_cost,
            'min_profitable_bid': min_profitable_bid,
        }
        
        # 3. Risk checks (including gas)
        risk_check = await self.risk_manager.check(decision_with_gas)
        
        if not risk_check['approved']:
            self.record_skip(intent, risk_check['reason'])
            return
        
        # 4. Execute
        await self.submit_bid(intent, decision_with_gas)
```

---

## The Reality

**Gas is not optional.**

If you ignore it:
- $300 bid, $50 gas, 25% win rate
- Expected value: -$12.50 (you lose money on average)

With gas optimization:
- Only bid $500+ (higher signal)
- Skip when gas > 60 GWEI
- Batch bids when possible
- Expected value: +$50-100 per bid

**Gas awareness turns -$12k/day into +$10k/day.**

That's the difference between bust and profit.

Monitor it. Optimize it. Never ignore it.
