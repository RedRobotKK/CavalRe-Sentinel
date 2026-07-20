#!/usr/bin/env node

/**
 * FETCH INTENT DATA FROM THE GRAPH (GraphQL)
 *
 * Uses The Graph subgraph for CoW Protocol
 * More reliable than direct API
 */

import axios from 'axios';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GRAPH_ENDPOINT = 'https://api.thegraph.com/subgraphs/name/cowprotocol/cow';

const TOKENS = {
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};

const DECIMALS = {
  [TOKENS.USDC]: 6,
  [TOKENS.USDT]: 6,
  [TOKENS.DAI]: 18,
  [TOKENS.WETH]: 18,
};

// ============================================================================
// DATABASE
// ============================================================================

const dbPath = path.join(__dirname, '../data/intents-archive.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS intents (
    id TEXT PRIMARY KEY,
    settlement_tx TEXT,
    order_uid TEXT,
    token_in TEXT,
    token_in_symbol TEXT,
    token_out TEXT,
    token_out_symbol TEXT,
    amount_in REAL,
    amount_out REAL,
    executed_amount_in REAL,
    executed_amount_out REAL,
    execution_price REAL,
    executed_surplus REAL,
    created_at INTEGER,
    settled_at INTEGER,
    status TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_token_pair ON intents(token_in, token_out);
  CREATE INDEX IF NOT EXISTS idx_settled_at ON intents(settled_at);
`);

// ============================================================================
// GRAPHQL QUERY
// ============================================================================

async function fetchFromGraph() {
  console.log('📡 Fetching from The Graph (CoW Protocol subgraph)...\n');

  const query = `
    query GetOrders($skip: Int!, $first: Int!) {
      orders(
        skip: $skip
        first: $first
        orderBy: createdAtBlock
        orderDirection: desc
        where: { status: fulfilled }
      ) {
        id
        uid
        orderUid
        owner
        sellToken
        buyToken
        sellAmount
        buyAmount
        executedSellAmount
        executedBuyAmount
        executedSurplus
        createdAtBlock
        settledAtBlock
        settlement {
          transactionHash
          timestamp
        }
        status
      }
    }
  `;

  let totalFetched = 0;
  let skip = 0;
  const pageSize = 1000;

  try {
    while (totalFetched < 10000) {
      console.log(`⏳ Fetching page ${Math.floor(skip / pageSize) + 1} (skip=${skip})...`);

      const response = await axios.post(GRAPH_ENDPOINT, {
        query: query,
        variables: {
          skip: skip,
          first: pageSize,
        },
      }, {
        timeout: 30000,
      });

      if (response.data.errors) {
        console.error('❌ GraphQL Error:', response.data.errors[0].message);
        break;
      }

      const orders = response.data.data.orders;

      if (!orders || orders.length === 0) {
        console.log('✅ End of data reached\n');
        break;
      }

      console.log(`   📥 Fetched ${orders.length} orders`);

      // Process and store
      processOrders(orders);
      totalFetched += orders.length;

      skip += pageSize;

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`✅ Total fetched: ${totalFetched}\n`);
    return totalFetched;
  } catch (error) {
    console.error('❌ Graph fetch error:', error.message);
    throw error;
  }
}

function processOrders(orders) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO intents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  for (const order of orders) {
    try {
      if (!order.executedSellAmount || order.executedSellAmount === '0') continue;

      const sellDecimals = DECIMALS[order.sellToken.toLowerCase()] || 18;
      const buyDecimals = DECIMALS[order.buyToken.toLowerCase()] || 18;

      const amountIn = parseFloat(order.sellAmount) / Math.pow(10, sellDecimals);
      const executedAmountIn = parseFloat(order.executedSellAmount) / Math.pow(10, sellDecimals);
      const executedAmountOut = parseFloat(order.executedBuyAmount) / Math.pow(10, buyDecimals);
      const executionPrice = executedAmountIn > 0 ? executedAmountOut / executedAmountIn : 0;
      const surplus = parseFloat(order.executedSurplus || 0) / Math.pow(10, buyDecimals);

      const createdAt = parseInt(order.createdAtBlock || 0);
      const settledAt = order.settlement ? parseInt(order.settlement.timestamp) : 0;

      insertStmt.run(
        order.uid,
        order.settlement?.transactionHash || '',
        order.uid,
        order.sellToken,
        getTokenSymbol(order.sellToken),
        order.buyToken,
        getTokenSymbol(order.buyToken),
        amountIn,
        parseFloat(order.buyAmount) / Math.pow(10, buyDecimals),
        executedAmountIn,
        executedAmountOut,
        executionPrice,
        surplus,
        createdAt,
        settledAt,
        order.status
      );

      inserted++;
    } catch (e) {
      // Skip bad records
    }
  }

  if (inserted > 0) {
    console.log(`   ✅ Stored ${inserted} records`);
  }
}

function analyzeData() {
  console.log('\n📊 Analyzing data...\n');

  const total = db.prepare('SELECT COUNT(*) as cnt FROM intents').get();
  console.log(`📈 Total intents: ${total.cnt.toLocaleString()}`);

  const topPairs = db.prepare(`
    SELECT
      token_in_symbol,
      token_out_symbol,
      COUNT(*) as count,
      AVG(execution_price) as avg_price
    FROM intents
    GROUP BY token_in, token_out
    ORDER BY count DESC
    LIMIT 10
  `).all();

  console.log('\n🏆 Top 10 token pairs:');
  topPairs.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.token_in_symbol}→${p.token_out_symbol}: ${p.count} orders`);
  });

  const profitStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) as wins,
      AVG(executed_surplus) as avg_surplus
    FROM intents
    WHERE executed_surplus IS NOT NULL
  `).get();

  console.log(`\n💰 Profitability:`);
  console.log(`   Total orders: ${profitStats.total}`);
  console.log(`   Profitable: ${profitStats.wins}`);
  if (profitStats.total > 0) {
    console.log(`   Win rate: ${((profitStats.wins / profitStats.total) * 100).toFixed(1)}%`);
  }
  console.log(`   Avg surplus: ${(profitStats.avg_surplus || 0).toFixed(6)} ETH`);
}

function exportToCsv() {
  console.log('\n💾 Exporting to CSV...');

  const orders = db.prepare(`
    SELECT
      order_uid,
      token_in_symbol,
      token_out_symbol,
      amount_in,
      executed_amount_out,
      execution_price,
      executed_surplus,
      created_at,
      settled_at
    FROM intents
    ORDER BY settled_at DESC
    LIMIT 5000
  `).all();

  const csv = [
    ['Order UID', 'Token In', 'Token Out', 'Amount In', 'Amount Out', 'Price', 'Surplus ETH', 'Created', 'Settled'].join(','),
    ...orders.map(o => [
      o.order_uid.slice(0, 16) + '...',
      o.token_in_symbol,
      o.token_out_symbol,
      o.amount_in.toFixed(2),
      o.executed_amount_out.toFixed(4),
      o.execution_price.toFixed(6),
      (o.executed_surplus || 0).toFixed(8),
      o.created_at,
      o.settled_at,
    ].join(','))
  ].join('\n');

  const csvPath = path.join(__dirname, '../intents-export.csv');
  fs.writeFileSync(csvPath, csv);
  console.log(`✅ Exported to: ${csvPath}\n`);
}

function getTokenSymbol(address) {
  const lower = address.toLowerCase();
  for (const [symbol, addr] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === lower) return symbol;
  }
  return address.slice(0, 6);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║  FETCH INTENT DATA FROM THE GRAPH          ║
║  CoW Protocol Subgraph (GraphQL)           ║
╚════════════════════════════════════════════╝
  `);

  try {
    const count = await fetchFromGraph();
    analyzeData();
    exportToCsv();

    console.log(`
✅ COMPLETE

Database: ${dbPath}
Records: ${count}

Next steps:
  1. Review intents-export.csv
  2. Train model: npm run train:model
  3. Backtest: npm run backtest
  4. Deploy: npm run start:mainnet
    `);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

await main();
