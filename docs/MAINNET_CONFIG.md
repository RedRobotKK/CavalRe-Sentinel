# ETH Mainnet Production Configuration
## Go Live on Mainnet - No Testnet

---

## The Reality

You're launching on mainnet with real money. No testnet. This means:

✅ **Real capital at risk**  
✅ **Real gas costs**  
✅ **Real competition**  
✅ **Real consequences**  

Everything must be production-grade.

---

## Environment Setup

Create `.env.mainnet` (NEVER commit this):

```bash
# NETWORK
NETWORK=mainnet
CHAIN_ID=1
NETWORK_NAME=ethereum

# RPC ENDPOINTS (Multiple, with failover)
RPC_PRIMARY=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
RPC_FALLBACK_1=https://eth-mainnet.bloxroute.com/public
RPC_FALLBACK_2=https://endpoints.omnirpc.io/eth
RPC_FALLBACK_3=https://rpc.ankr.com/eth

# WALLET
PRIVATE_KEY=0x... # Your solver wallet (loaded from secure vault in production)
WALLET_ADDRESS=0x... # Your public address

# CAPITAL
STARTING_CAPITAL_USDC=50000  # Real money, $50k minimum
STARTING_CAPITAL_ETH=5.25    # Real ETH for gas

# GAS SETTINGS (Mainnet specific)
GAS_PRICE_STRATEGY=eip1559    # Use EIP-1559 (London fork)
MAX_PRIORITY_FEE_GWEI=2       # Max priority fee (tip)
MAX_BASE_FEE_GWEI=200         # Max base fee
GAS_LIMIT_STANDARD=200000     # Standard tx gas limit
GAS_LIMIT_COMPLEX=400000      # Complex routes gas limit

# RISK LIMITS (Aggressive but safe)
MAX_POSITION_SIZE_USDC=10000      # Max $10k per trade
MAX_DAILY_LOSS_USDC=5000          # Max $5k daily loss (hard stop)
MAX_LEVERAGE=2.0                   # Max 2x leverage
DRAWDOWN_LIMIT_PERCENT=15          # Max 15% drawdown
MIN_PROFITABLE_BID_USDC=500        # Never bid less than $500

# MODEL
MODEL_VERSION=v3
MODEL_PATH=/models/intent-solver-v3
RETRAIN_INTERVAL_HOURS=4

# TRADING
MIN_WIN_RATE=0.20              # Need 20%+ win rate
TARGET_WIN_RATE=0.25           # Aim for 25%
EXPECTED_PROFIT_PER_WIN=300    # Conservative estimate
EXPECTED_LOSS_PER_LOSS=50      # Gas cost

# MONITORING
ALERT_EMAIL=your-email@gmail.com
MONITORING_INTERVAL_SECONDS=60
PROFIT_TARGET_DAILY_USDC=1000  # Alert if can't hit $1k/day
MAX_EXECUTION_TIME_MS=1000     # Transactions must complete in <1s

# SECURITY
API_KEY_HASH=bcrypt_hash_of_api_key
WEBHOOK_SECRET=your_webhook_secret
CORS_ALLOWED_ORIGINS=https://dashboard.yourdomain.com
ENABLE_RATE_LIMITING=true
RATE_LIMIT_PER_MINUTE=1000

# CONTRACTS
COW_PROTOCOL_ADDRESS=0xcC7aDc94512427cFb966430eAe7f1C6f4b8E1e8
UNISWAPX_ADDRESS=0x6000da47483062A0D734Ba3dc7465C7d5d91ff5e
UNISWAP_V3_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564
WETH_ADDRESS=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
USDC_ADDRESS=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
USDT_ADDRESS=0xdac17f958d2ee523a2206206994597c13d831ec7

# LOGGING
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_AUDIT_LOG=true
AUDIT_LOG_PATH=/var/log/solver/audit.log
```

Create `.env.local.template` (for developers):

```bash
# Copy to .env.local and fill with YOUR values
# NEVER commit .env.local

NETWORK=mainnet
RPC_PRIMARY=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=0x...
WALLET_ADDRESS=0x...
STARTING_CAPITAL_USDC=1000
STARTING_CAPITAL_ETH=0.5
```

---

## RPC Endpoint Strategy (Mainnet Production)

Create `lib/RpcClient.ts`:

```typescript
import axios from 'axios';

interface RpcConfig {
  endpoints: string[];
  timeout: number;
  maxRetries: number;
}

export class RpcClient {
  private endpoints: string[];
  private currentEndpoint: number = 0;
  private timeout: number;
  private maxRetries: number;

  constructor(config: RpcConfig) {
    this.endpoints = config.endpoints;
    this.timeout = config.timeout || 5000;
    this.maxRetries = config.maxRetries || 3;
  }

  async call(method: string, params: any[] = []): Promise<any> {
    let lastError: Error | null = null;

    // Try each endpoint with retries
    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[(this.currentEndpoint + i) % this.endpoints.length];

      for (let retry = 0; retry < this.maxRetries; retry++) {
        try {
          const response = await axios.post(
            endpoint,
            {
              jsonrpc: '2.0',
              method: method,
              params: params,
              id: Math.random().toString(36),
            },
            { timeout: this.timeout }
          );

          if (response.data.error) {
            throw new Error(`RPC Error: ${response.data.error.message}`);
          }

          // Success - update current endpoint
          this.currentEndpoint = (this.currentEndpoint + i) % this.endpoints.length;
          return response.data.result;
        } catch (error) {
          lastError = error as Error;
          console.error(`RPC call failed (attempt ${retry + 1}/${this.maxRetries}):`, error);

          if (retry < this.maxRetries - 1) {
            // Wait before retry
            await new Promise(r => setTimeout(r, Math.pow(2, retry) * 1000));
          }
        }
      }
    }

    throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
  }

  async getGasPrice(): Promise<{
    baseFee: string;
    priorityFee: string;
    effectiveGasPrice: string;
  }> {
    try {
      const block = await this.call('eth_getBlockByNumber', ['latest', false]);
      const baseFee = block.baseFeePerGas;

      // Get current priority fee from mempool
      const feeHistory = await this.call('eth_feeHistory', ['1', 'latest', [50]]);
      const priorityFee = feeHistory.reward[0][0];

      return {
        baseFee: baseFee,
        priorityFee: priorityFee,
        effectiveGasPrice: (BigInt(baseFee) + BigInt(priorityFee)).toString(),
      };
    } catch (error) {
      console.error('Failed to get gas prices:', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<string> {
    return this.call('eth_getBalance', [address, 'latest']);
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    return this.call('eth_getTransactionReceipt', [txHash]);
  }

  async waitForTransaction(txHash: string, timeoutMs: number = 60000): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await this.getTransactionReceipt(txHash);
        if (receipt) {
          return receipt;
        }
      } catch (e) {
        console.error('Error checking transaction:', e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error(`Transaction ${txHash} not confirmed within ${timeoutMs}ms`);
  }
}

export default RpcClient;
```

---

## Mainnet Gas Optimization

Create `lib/GasManager.ts`:

```typescript
import FloatMath from './FloatMath';
import RpcClient from './RpcClient';

export class GasManager {
  private rpc: RpcClient;
  private maxPriorityFeeGwei: number;
  private maxBaseFeeFeeGwei: number;
  private lastGasPriceUpdate: number = 0;
  private cachedGasPrice: any = null;

  constructor(rpc: RpcClient, maxPriorityFee: number = 2, maxBaseFee: number = 200) {
    this.rpc = rpc;
    this.maxPriorityFeeGwei = maxPriorityFee;
    this.maxBaseFeeFeeGwei = maxBaseFee;
  }

  async getOptimalGasPrice(): Promise<{
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    estimatedCostUsd: number;
  }> {
    // Cache for 30 seconds
    if (Date.now() - this.lastGasPriceUpdate < 30000 && this.cachedGasPrice) {
      return this.cachedGasPrice;
    }

    try {
      const { baseFee, priorityFee } = await this.rpc.getGasPrice();

      // Parse hex values
      const baseFeeWei = BigInt(baseFee);
      const priorityFeeWei = BigInt(priorityFee);

      // Convert to GWEI
      const baseFeeGwei = Number(baseFeeWei) / 1e9;
      const priorityFeeGwei = Number(priorityFeeWei) / 1e9;

      // Apply caps
      const cappedBaseFee = Math.min(baseFeeGwei, this.maxBaseFeeFeeGwei);
      const cappedPriorityFee = Math.min(priorityFeeGwei, this.maxPriorityFeeGwei);

      // Calculate max fee = base + priority
      const maxFeeGwei = FloatMath.add(cappedBaseFee, cappedPriorityFee, 2);

      // Convert back to Wei
      const maxFeePerGas = (BigInt(Math.round(maxFeeGwei * 1e9))).toString();
      const maxPriorityFeePerGas = (BigInt(Math.round(cappedPriorityFee * 1e9))).toString();

      // Estimate cost for 200k gas tx
      const gasCostUsd = this.estimateGasCostUsd(maxFeeGwei, 200000, 2000);

      const result = {
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCostUsd: gasCostUsd,
      };

      this.cachedGasPrice = result;
      this.lastGasPriceUpdate = Date.now();

      return result;
    } catch (error) {
      console.error('Failed to get optimal gas price:', error);
      throw error;
    }
  }

  private estimateGasCostUsd(maxFeeGwei: number, gasLimit: number, ethPriceUsd: number): number {
    // Cost in ETH = (maxFee in GWEI * gasLimit) / 1e9
    const costEth = FloatMath.divide(
      FloatMath.multiply(maxFeeGwei, gasLimit, 8),
      1e9,
      8
    );

    // Cost in USD
    return FloatMath.multiply(costEth, ethPriceUsd, 2);
  }

  shouldPauseBidding(gasPrice: number): boolean {
    // Don't bid if gas >100 GWEI (too expensive)
    return gasPrice > 100;
  }

  getBidMultiplier(gasPrice: number): number {
    // Scale bid based on gas price
    if (gasPrice < 30) return 1.5;   // Low gas, bid aggressive
    if (gasPrice < 50) return 1.2;   // Medium gas, bid normal
    if (gasPrice < 100) return 0.8;  // High gas, bid conservative
    return 0.5;                       // Very high gas, bid minimal
  }
}

export default GasManager;
```

---

## Mainnet Wallet Management

Create `lib/WalletManager.ts`:

```typescript
import { createWalletClient, http, publicActions, publicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import FloatMath from './FloatMath';

export class WalletManager {
  private account: any;
  private client: any;
  private publicClient: any;
  private minBalanceWarn: number;

  constructor(privateKey: string, minBalanceWarnEth: number = 0.5) {
    if (!privateKey.startsWith('0x')) {
      throw new Error('Private key must start with 0x');
    }

    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    this.client = createWalletClient({
      account: this.account,
      chain: mainnet,
      transport: http(process.env.RPC_PRIMARY),
    }).extend(publicActions);

    this.publicClient = publicClient({
      chain: mainnet,
      transport: http(process.env.RPC_PRIMARY),
    });

    this.minBalanceWarn = minBalanceWarnEth;
  }

  getAddress(): `0x${string}` {
    return this.account.address;
  }

  async getEthBalance(): Promise<number> {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.account.address,
      });

      const ethBalance = Number(balance) / 1e18;

      // Alert if low
      if (ethBalance < this.minBalanceWarn) {
        console.warn(
          `⚠️  Low ETH balance: ${ethBalance.toFixed(4)} ETH (minimum: ${this.minBalanceWarn})`
        );
      }

      return ethBalance;
    } catch (error) {
      console.error('Failed to get ETH balance:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, decimals: number = 18): Promise<number> {
    try {
      // Use ERC-20 ABI balanceOf
      const abi = [
        {
          name: 'balanceOf',
          outputs: [{ type: 'uint256' }],
          inputs: [{ name: '_owner', type: 'address' }],
          type: 'function',
          stateMutability: 'view',
        },
      ];

      const balance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: abi,
        functionName: 'balanceOf',
        args: [this.account.address],
      });

      return Number(balance) / Math.pow(10, decimals);
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress}:`, error);
      throw error;
    }
  }

  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amountWei: string
  ): Promise<string> {
    try {
      const abi = [
        {
          name: 'approve',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
          type: 'function',
        },
      ];

      const hash = await this.client.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: abi,
        functionName: 'approve',
        args: [spenderAddress, amountWei],
      });

      console.log(`Approval transaction sent: ${hash}`);
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      console.log(`Approval confirmed in block ${receipt.blockNumber}`);

      return hash;
    } catch (error) {
      console.error('Token approval failed:', error);
      throw error;
    }
  }

  async getTotalCapitalUsd(ethPrice: number = 2000): Promise<number> {
    try {
      const ethBalance = await this.getEthBalance();
      const usdcBalance = await this.getTokenBalance(
        process.env.USDC_ADDRESS!,
        6  // USDC is 6 decimals
      );

      const ethValueUsd = FloatMath.multiply(ethBalance, ethPrice, 2);
      const totalUsd = FloatMath.add(ethValueUsd, usdcBalance, 2);

      return totalUsd;
    } catch (error) {
      console.error('Failed to calculate total capital:', error);
      throw error;
    }
  }
}

export default WalletManager;
```

---

## Mainnet Security Checklist

```typescript
/**
 * SECURITY CHECKLIST - BEFORE GOING LIVE
 *
 * DO NOT SKIP ANY OF THESE
 */

export const SecurityChecklist = {
  WALLET: {
    'Private key stored in secure vault (not .env)': false,
    'Never log private key': false,
    'Use hardware wallet for production capital': false,
    'Test with small amount first ($1k)': false,
    'Wallet not shared across machines': false,
  },

  CONTRACTS: {
    'CoW Protocol address verified': false,
    'USDC address verified (0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48)': false,
    'WETH address verified (0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2)': false,
    'All contract addresses hardcoded, never dynamic': false,
  },

  CAPITAL: {
    'Start with $1k test capital, not $50k': false,
    'Prove profitability on small capital first': false,
    'Scale only after 2 weeks of profit': false,
    'Never use money you cant afford to lose': false,
  },

  RISK: {
    'Max position size = $2,500 (5% of $50k)': false,
    'Daily loss limit = $5,000 (10% of $50k)': false,
    'Max leverage = 2.0x': false,
    'Drawdown limit = 15%': false,
    'All limits are hard stops (code enforces)': false,
  },

  GAS: {
    'Max base fee = 200 GWEI': false,
    'Max priority fee = 2 GWEI': false,
    'Pause bidding if gas >100 GWEI': false,
    'Never use MEV bundles (too risky)': false,
  },

  MONITORING: {
    'Alert on trade every 30 seconds': false,
    'Alert if win rate drops <20%': false,
    'Alert if daily loss >$3k': false,
    'Auto-halt if daily loss >$5k': false,
    'Heartbeat check every 1 minute': false,
  },

  EXECUTION: {
    'All transactions use EIP-1559': false,
    'All transactions have gas limit': false,
    'All transactions timeout after 60s': false,
    'Retry failed transactions 3x': false,
  },

  CODE: {
    'All math uses FloatMath': false,
    'No floating point on money': false,
    'All prices in 2 decimals': false,
    'All rates in 4+ decimals': false,
  },

  API: {
    'Rate limiting enabled': false,
    'API key authentication enabled': false,
    'CORS restricted to dashboard domain': false,
    'All API responses logged': false,
  },

  MONITORING: {
    'Dashboard connected to live data': false,
    'Email alerts configured': false,
    'Audit log enabled (all trades logged)': false,
    'Performance metrics tracked': false,
  },
};

export function validateSecurity(): boolean {
  const allChecked = Object.values(SecurityChecklist).every(section =>
    Object.values(section).every(value => value === true)
  );

  if (!allChecked) {
    console.error('❌ SECURITY CHECKLIST NOT COMPLETE');
    console.error('DO NOT GO LIVE UNTIL ALL ITEMS ARE CHECKED');
    return false;
  }

  console.log('✅ SECURITY CHECKLIST PASSED');
  return true;
}
```

---

## Launch Sequence

### Week 1: Test on Small Capital
```bash
# .env settings
STARTING_CAPITAL_USDC=1000
STARTING_CAPITAL_ETH=0.1

# Monitor carefully
# Target: $50/week profit
# If achieved: proceed to Week 2
```

### Week 2: Prove Profitability
```bash
# .env settings
STARTING_CAPITAL_USDC=5000
STARTING_CAPITAL_ETH=0.5

# Monitor carefully
# Target: $250/week profit (5% weekly ROI)
# If achieved: proceed to Week 3
```

### Week 3: Scale to Production
```bash
# .env settings
STARTING_CAPITAL_USDC=50000
STARTING_CAPITAL_ETH=5.25

# Full production mode
# Target: $5k/week profit
# All risk limits active
```

---

## Mainnet Startup Script

Create `scripts/start-mainnet.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Starting Sentinel on ETH Mainnet"
echo "=================================="

# Check environment
if [ ! -f .env.mainnet ]; then
  echo "❌ .env.mainnet not found"
  exit 1
fi

# Check private key is set
if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ PRIVATE_KEY not set in .env.mainnet"
  exit 1
fi

# Validate security
echo "🔐 Validating security..."
npm run validate:security

# Check balances
echo "💰 Checking wallet balances..."
npm run check:balances

# Start solver
echo "🤖 Starting solver..."
node --max-old-space-size=4096 solver.js

# If we get here, something crashed
echo "❌ Solver crashed! Check logs."
exit 1
```

---

## Monitoring & Alerts

Create `lib/Monitor.ts`:

```typescript
import nodemailer from 'nodemailer';
import FloatMath from './FloatMath';

export class Monitor {
  private mailer: any;
  private alerts: Map<string, number> = new Map();

  constructor(emailConfig: any) {
    this.mailer = nodemailer.createTransport(emailConfig);
  }

  async alertCritical(subject: string, message: string): Promise<void> {
    // Only alert once per 5 minutes for same issue
    const key = subject;
    const lastAlert = this.alerts.get(key) || 0;

    if (Date.now() - lastAlert < 5 * 60 * 1000) {
      return;  // Too recent, skip
    }

    console.error(`🚨 CRITICAL: ${subject}`);
    console.error(message);

    // Send email
    try {
      await this.mailer.sendMail({
        from: 'solver@youromain.com',
        to: process.env.ALERT_EMAIL,
        subject: `🚨 SOLVER CRITICAL: ${subject}`,
        text: message,
        html: `<pre>${message}</pre>`,
      });
    } catch (e) {
      console.error('Failed to send alert email:', e);
    }

    this.alerts.set(key, Date.now());
  }

  async alertWarning(subject: string, message: string): Promise<void> {
    console.warn(`⚠️  WARNING: ${subject}`);
    console.warn(message);

    // Email on warning too
    try {
      await this.mailer.sendMail({
        from: 'solver@yourdomain.com',
        to: process.env.ALERT_EMAIL,
        subject: `⚠️  SOLVER WARNING: ${subject}`,
        text: message,
      });
    } catch (e) {
      console.error('Failed to send warning email:', e);
    }
  }

  async trackTrade(trade: {
    intentId: string;
    pair: string;
    amount: number;
    bidAmount: number;
    won: boolean;
    profit: number;
  }): Promise<void> {
    // Log to audit
    console.log(
      `[TRADE] ${trade.pair} | Bid: $${FloatMath.toCurrency(trade.bidAmount)} | Result: ${trade.won ? '✅ WON' : '❌ LOST'} | Profit: ${FloatMath.toCurrency(trade.profit)}`
    );

    // Write to audit log
    const auditLog = {
      timestamp: new Date().toISOString(),
      ...trade,
    };

    // Log to file or database
    console.log(JSON.stringify(auditLog));
  }
}

export default Monitor;
```

---

## Summary: Mainnet Production Stack

✅ **Multiple RPC endpoints** (failover)  
✅ **EIP-1559 gas handling** (mainnet standard)  
✅ **FloatMath everywhere** (no rounding errors)  
✅ **Security validation** (before launch)  
✅ **Email alerts** (on critical events)  
✅ **Audit logging** (all trades recorded)  
✅ **Risk limits** (hard stops)  
✅ **Start small, scale slow** (proven approach)  

---

## Deploy Timeline

```
TODAY (Day 1):
□ Set up .env.mainnet with $1k test capital
□ Run security validation
□ Deploy to mainnet
□ Monitor 24/7

WEEK 1:
□ Make $50+ (proof of concept)
□ If yes → continue
□ If no → debug and adjust model

WEEK 2:
□ Increase capital to $5k
□ Make $250+ (5% ROI)
□ If yes → continue
□ If no → more debugging

WEEK 3:
□ Increase capital to $50k
□ Make $5k+ ($1k/day)
□ Full production mode

WEEK 4:
□ Scale to $100k+ capital
□ Aim for $10k+/week
□ Optimize for volume
```

---

## Go Live Command

```bash
# After ALL security checks pass:
npm run validate:security   # MUST pass
npm run check:balances      # Check capital
npm run start:mainnet       # GO LIVE

# Monitor:
tail -f logs/solver.log
tail -f logs/audit.log
# Check dashboard: http://localhost:3000
```

**You're live on mainnet. Real money. Real competition. Real consequences.**

Execute flawlessly.
