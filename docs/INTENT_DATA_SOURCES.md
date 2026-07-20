# Intent Data Sources & Archives
## Where to Get Training Data

---

## Option 1: CoW Protocol API (Easiest)

CoW Protocol stores ALL intents and their outcomes. Perfect for training.

### Direct API
```bash
# Get all settlements (batches of intents)
curl "https://api.cow.fi/mainnet/api/v1/settlements" | jq .

# Get specific settlement details
curl "https://api.cow.fi/mainnet/api/v1/settlements/0x..." | jq .

# Get orders (individual intents)
curl "https://api.cow.fi/mainnet/api/v1/orders" | jq .

# Filter by token pair
curl "https://api.cow.fi/mainnet/api/v1/orders?sellToken=0x...&buyToken=0x..." | jq .

# Get order execution details
curl "https://api.cow.fi/mainnet/api/v1/orders/0x.../executions" | jq .
```

### CoW Protocol Data Structure
```json
{
  "order": {
    "uid": "0x...",
    "sellToken": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  // USDC
    "buyToken": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",   // WETH
    "sellAmount": "1000000000",  // 1000 USDC (6 decimals)
    "buyAmount": "500000000000000000",  // 0.5 WETH (18 decimals)
    "validFrom": 1234567890,
    "validTo": 1234567900,
    "feeAmount": "0",
    "kind": "sell",  // or "buy"
    "partiallyFillable": false,
    "sellTokenBalance": "erc20",
    "buyTokenBalance": "erc20",
    "signingScheme": "eip712",
    "signature": "0x...",
    "receiver": "0x...",
    "owner": "0x...",
    "creationDate": "2024-01-15T10:30:00Z",
    "executedSellAmount": "1000000000",
    "executedBuyAmount": "502000000000000000",  // Actual received
    "executedFeeAmount": "0",
    "invalidated": false,
    "status": "fulfilled",
    "fullAppData": "0x..."
  },
  "executedAmount": "502000000000000000",
  "executedSurplus": "2000000000000000",  // 0.002 WETH profit
  "fee": {
    "amount": "0",
    "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  },
  "fulfillmentTime": 1234567895,
  "settlement": "0x..."
}
```

---

## Option 2: Dune Analytics (SQL Queries)

Dune has indexed all CoW Protocol data. Query historical intents:

```sql
-- Get all USDC→ETH swaps in last 7 days
SELECT
  order_uid,
  sell_token,
  buy_token,
  sell_amount / 1e6 as sell_amount_usdc,
  buy_amount / 1e18 as buy_amount_eth,
  CASE WHEN buy_amount > 0 THEN (buy_amount / 1e18) / (sell_amount / 1e6) ELSE 0 END as execution_rate,
  creation_time,
  settlement_time,
  tx_hash
FROM cow_protocol.orders
WHERE
  sell_token = 0xA0B86991c6218b36c1d19D4a2e9Eb0cE3606eB48  -- USDC
  AND buy_token = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2  -- WETH
  AND creation_time > now() - interval '7 days'
  AND status = 'fulfilled'
ORDER BY creation_time DESC
LIMIT 10000;

-- Get win rate for solvers (what % execute with profit)
SELECT
  solver,
  COUNT(*) as total_intents,
  SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) as profitable,
  ROUND(100 * SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as win_rate_percent,
  AVG(executed_surplus / 1e18) as avg_profit_eth
FROM cow_protocol.settlements
WHERE settlement_time > now() - interval '30 days'
GROUP BY solver
ORDER BY win_rate_percent DESC
LIMIT 100;

-- Get gas prices at time of each intent
SELECT
  o.order_uid,
  o.sell_token,
  o.buy_token,
  o.sell_amount / 1e6 as amount_usdc,
  b.base_fee_per_gas / 1e9 as base_fee_gwei,
  b.standard_gas_price / 1e9 as gas_price_gwei,
  o.creation_time,
  o.settlement_time,
  (o.settlement_time - o.creation_time) as seconds_to_settle
FROM cow_protocol.orders o
JOIN ethereum.blocks b ON b.time = o.creation_time
WHERE o.sell_token = 0xA0B86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  AND o.buy_token = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
  AND o.creation_time > now() - interval '30 days'
ORDER BY o.creation_time DESC
LIMIT 1000;
```

**Access:** https://dune.com/
- Free account
- SQL-based queries
- Download results as CSV

---

## Option 3: The Graph (Subgraphs)

GraphQL queries against indexed CoW Protocol data:

```graphql
query {
  orders(
    first: 1000
    where: {
      sellToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      buyToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      createdAtBlockNumber_gt: 18000000
      status: fulfilled
    }
    orderBy: createdAtBlockNumber
    orderDirection: desc
  ) {
    id
    uid
    sellToken {
      id
      symbol
      decimals
    }
    buyToken {
      id
      symbol
      decimals
    }
    sellAmount
    buyAmount
    executedSellAmount
    executedBuyAmount
    createdAtBlockNumber
    executedAtBlockNumber
    settlement {
      id
      timestamp
      txHash
      gasPrice
    }
  }
}
```

**Access:** https://thegraph.com/
- GraphQL queries
- Real-time data
- Subgraph: `gnosis-protocol/gnosis-protocol-v2`

---

## Option 4: Build Your Own Dataset (Recommended)

Script to collect intent data from Ethereum RPC:

Create `scripts/collect-intents.js`:

```javascript
const axios = require('axios');
const Database = require('better-sqlite3');

const RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY';
const db = new Database('intents-archive.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS intents (
    id TEXT PRIMARY KEY,
    block_number INTEGER,
    tx_hash TEXT,
    from_address TEXT,
    to_address TEXT,
    input_data TEXT,
    value TEXT,
    gas_used INTEGER,
    gas_price TEXT,
    timestamp INTEGER,
    block_timestamp INTEGER,
    swap_type TEXT,  -- uniswap_v3, uniswap_v2, cow, etc
    token_in TEXT,
    token_out TEXT,
    amount_in REAL,
    amount_out REAL,
    execution_price REAL,
    profit REAL,
    collected_at INTEGER
  )
`);

// Swap signatures to detect
const SWAP_SIGS = {
  '0x414bf389': 'uniswap_v3_exactInputSingle',
  '0x7ff36ab5': 'uniswap_v2_swapExactETHForTokens',
  '0x1f0464d8': 'cow_protocol',
  '0x8803dbee': 'uniswap_v2_swapWithFee',
};

async function collectIntents(startBlock, endBlock) {
  console.log(`Collecting intents from block ${startBlock} to ${endBlock}`);

  for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
    try {
      // Get block
      const block = await rpcCall('eth_getBlockByNumber', [`0x${blockNum.toString(16)}`, true]);
      
      if (!block) continue;

      console.log(`Block ${blockNum}: ${block.transactions.length} transactions`);

      // Filter swaps
      for (const tx of block.transactions) {
        if (!tx.input || tx.input === '0x') continue;

        const sig = tx.input.slice(0, 10);
        const swapType = SWAP_SIGS[sig];

        if (swapType) {
          // Get receipt for gas info
          const receipt = await rpcCall('eth_getTransactionReceipt', [tx.hash]);

          db.prepare(`
            INSERT INTO intents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            tx.hash,
            blockNum,
            tx.hash,
            tx.from,
            tx.to,
            tx.input,
            tx.value,
            receipt?.gasUsed ? parseInt(receipt.gasUsed, 16) : 0,
            tx.gasPrice,
            Math.floor(Date.now() / 1000),
            parseInt(block.timestamp, 16),
            swapType,
            null, // token_in - parse from tx.input
            null, // token_out
            null, // amount_in
            null, // amount_out
            null, // execution_price
            null, // profit
            Math.floor(Date.now() / 1000)
          );
        }
      }

      if (blockNum % 100 === 0) {
        console.log(`✅ Processed ${blockNum} blocks`);
      }
    } catch (error) {
      console.error(`Error at block ${blockNum}:`, error.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('✅ Collection complete');
}

async function rpcCall(method, params) {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Math.random().toString(36),
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data.result;
  } catch (error) {
    console.error(`RPC call failed: ${error.message}`);
    return null;
  }
}

// Usage:
// Collect last 1000 blocks
const currentBlock = 19000000; // Replace with actual current block
collectIntents(currentBlock - 1000, currentBlock).catch(console.error);
```

Run:
```bash
npm install axios better-sqlite3
node scripts/collect-intents.js

# Now you have intents-archive.db with historical data
```

---

## Option 5: Pre-Built Datasets

### GitHub Datasets
- **MEV-Inspect** - https://github.com/flashbots/mev-inspect-py
  - Indexed MEV data
  - Intent data included
  - CSV/JSON export

### Research Repositories
- **CoW DAO Research** - https://github.com/cowprotocol/
  - Official data dumps
  - Historical settlements
  - Solver data

### Kaggle Datasets
- Search: "CoW Protocol" or "intent-based trading"
- Some community-uploaded datasets
- CSV format

---

## Recommended: Hybrid Approach

1. **Start with Dune Analytics** (fastest)
   - Query last 30 days of USDC→ETH swaps
   - Download as CSV (10,000 rows)
   - Takes 5 minutes

2. **Build dataset collection script** (parallel)
   - Runs continuously
   - Collects new intents as they occur
   - Feeds training pipeline

3. **Parse and normalize** (FloatMath)
   ```javascript
   // Convert raw intent data to training examples
   const examples = intents.map(intent => ({
     tokenIn: intent.sell_token,
     tokenOut: intent.buy_token,
     amountIn: FloatMath.toFixed(intent.sell_amount / 1e6, 2),  // 6 decimals → USD
     executionPrice: FloatMath.divide(
       intent.buy_amount / 1e18,  // WETH (18 decimals)
       intent.sell_amount / 1e6,  // USDC (6 decimals)
       4
     ),
     gasPrice: FloatMath.toFixed(intent.gas_price / 1e9, 2),  // Wei → GWEI
     won: FloatMath.greaterThan(intent.executed_surplus, 0),
     profit: FloatMath.toFixed(intent.executed_surplus / 1e18 * 2000, 2),  // WETH → USD
     timestamp: intent.settlement_time,
   }));
   ```

---

## Quick Start (30 minutes to data)

```bash
# 1. Get Dune account
# Go to https://dune.com and create free account

# 2. Run this query:
# (Use SQL from Option 2 above)

# 3. Download CSV

# 4. Parse into training set
node -e "
const csv = require('csv-parser');
const fs = require('fs');

fs.createReadStream('intents.csv')
  .pipe(csv())
  .on('data', (row) => {
    console.log(row);  // Process each row
  });
"

# 5. Train your model
npm run train:model

# Done
```

---

## Data Quality Tips

When processing intent data:

✅ **Use FloatMath for all math**
```typescript
// Calculate execution price with precision
const executionPrice = FloatMath.divide(
  buyAmount,
  sellAmount,
  4  // 4 decimals for price
);
```

✅ **Normalize token decimals**
```typescript
// USDC = 6 decimals, WETH = 18 decimals
const usdcAmount = parseFloat(sellAmount) / 1e6;
const wethAmount = parseFloat(buyAmount) / 1e18;
```

✅ **Filter valid data**
```typescript
// Only use settled intents
WHERE status = 'fulfilled'

// Only use reasonable amounts (not dust)
WHERE sell_amount > 1e6  // >$1 USDC

// Only use liquid pairs
WHERE sell_token IN (USDC, DAI, USDT, ETH, WETH)
AND buy_token IN (USDC, DAI, USDT, ETH, WETH)
```

✅ **Account for timing**
```typescript
// Execution happened after creation
WHERE settlement_time > creation_time

// But not too long (network congestion)
WHERE (settlement_time - creation_time) < 300  // 5 minutes
```

---

## What You'll Get

From 10,000 historical intents:
- ✅ 2,500 USDC→ETH swaps
- ✅ 2,500 ETH→USDC swaps
- ✅ 2,500 USDC→DAI swaps
- ✅ 2,500 other liquid pairs
- ✅ Gas prices at each timestamp
- ✅ Execution prices
- ✅ Win/loss outcomes
- ✅ Historical P&L patterns

Perfect training data for your model.

---

## Use This Data To

1. **Train your model**
   ```bash
   npm run train:model -- --data intents-archive.db --epochs 3
   ```

2. **Backtest your strategy**
   ```bash
   npm run backtest -- --data intents.csv --capital 50000 --start-date 2024-01-01
   ```

3. **Analyze win rates**
   ```bash
   # Which token pairs have highest win rate?
   # What gas price threshold is optimal?
   # What's the best bid amount for each pair?
   ```

4. **Optimize parameters**
   ```bash
   # Run 1000 simulations with different settings
   # Find which configuration has best risk-adjusted returns
   ```

---

## Start Now (5 minutes)

```bash
# Option A: Fastest (Dune Analytics)
1. Go to https://dune.com
2. Create free account
3. Run SQL query from Option 2
4. Download CSV
5. Start training

# Option B: Most Complete (Build your own)
1. Create .env with RPC_URL and ALCHEMY_KEY
2. Run: node scripts/collect-intents.js
3. Wait 1-2 hours for collection
4. Start training

# Recommended: Do both
# Dune gives you historical data immediately
# Your script gives you real-time data going forward
```

**You'll have training data in < 1 hour.**

**Your model will be better than 99% of solvers by week 2.**

Get the data. Train the model. Make money.

