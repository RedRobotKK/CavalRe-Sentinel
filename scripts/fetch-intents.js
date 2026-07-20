#!/usr/bin/env node

/**
 * FETCH INTENT DATA FROM COW PROTOCOL API
 *
 * This script fetches historical intent data and stores it for training.
 * No authentication needed - uses public CoW API.
 *
 * Usage:
 *   node scripts/fetch-intents.js
 *
 * Output:
 *   - intents-raw.json (raw data from API)
 *   - intents-archive.db (SQLite database)
 */

import axios from 'axios';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIG
// ============================================================================

const COW_API_BASE = 'https://api.cow.fi/mainnet/api/v1';

// Token addresses (mainnet)
const TOKENS = {
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
};

const DECIMALS = {
  [TOKENS.USDC]: 6,
  [TOKENS.USDT]: 6,
  [TOKENS.DAI]: 18,
  [TOKENS.WETH]: 18,
  [TOKENS.WBTC]: 8,
};

// ============================================================================
// INITIALIZE DATABASE
// ============================================================================

const dbPath = path.join(__dirname, '../data/intents-archive.db');
console.log(`📦 Database: ${dbPath}`);

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS intents (
    id TEXT PRIMARY KEY,
    settlement_tx TEXT,
    order_uid TEXT,
    seller TEXT,
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
    execution_surplus_usd REAL,
    gas_used INTEGER,
    created_at INTEGER,
    settled_at INTEGER,
    status TEXT,
    raw_data TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_token_pair ON intents(token_in, token_out);
  CREATE INDEX IF NOT EXISTS idx_settled_at ON intents(settled_at);
  CREATE INDEX IF NOT EXISTS idx_status ON intents(status);
`);

console.log('✅ Database initialized');

// ============================================================================
// FETCH DATA
// ============================================================================

async function fetchIntents() {
  console.log('\n🔍 Fetching intent data from CoW Protocol API...\n');

  let totalFetched = 0;
  let batchSize = 1000;
  let offset = 0;
  let allOrders = [];

  try {
    // Keep fetching until we get less than batch size (end of data)
    while (true) {
      console.log(`⏳ Fetching batch: offset=${offset}, limit=${batchSize}...`);

      const response = await axios.get(`${COW_API_BASE}/orders`, {
        params: {
          limit: batchSize,
          offset: offset,
          orderBy: 'createdAt',
          ordering: 'desc',
        },
        timeout: 30000,
      });

      const orders = response.data;

      if (!orders || orders.length === 0) {
        console.log('✅ End of data reached');
        break;
      }

      console.log(`   📥 Fetched ${orders.length} orders`);
      allOrders = allOrders.concat(orders);
      totalFetched += orders.length;

      // Stop after 10,000 to keep it manageable
      if (totalFetched >= 10000) {
        console.log(`✅ Reached 10,000 orders limit`);
        break;
      }

      offset += batchSize;

      // Be nice to the API
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n✅ Total orders fetched: ${totalFetched}`);
    return allOrders;
  } catch (error) {
    console.error('❌ Error fetching intents:', error.message);
    throw error;
  }
}

// ============================================================================
// PROCESS & STORE DATA
// ============================================================================

function processOrders(orders) {
  console.log('\n📊 Processing orders...\n');

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO intents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      // Skip if no executed amounts (never settled)
      if (!order.executedSellAmount || order.executedSellAmount === '0') {
        skipped++;
        continue;
      }

      // Get token decimals
      const sellDecimals = DECIMALS[order.sellToken.toLowerCase()] || 18;
      const buyDecimals = DECIMALS[order.buyToken.toLowerCase()] || 18;

      // Convert to decimal amounts (using FloatMath principles)
      const amountIn = parseFloat(order.sellAmount) / Math.pow(10, sellDecimals);
      const amountOut = parseFloat(order.buyAmount) / Math.pow(10, buyDecimals);
      const executedAmountIn = parseFloat(order.executedSellAmount) / Math.pow(10, sellDecimals);
      const executedAmountOut = parseFloat(order.executedBuyAmount) / Math.pow(10, buyDecimals);

      // Calculate execution price
      const executionPrice = executedAmountIn > 0 ? executedAmountOut / executedAmountIn : 0;

      // Calculate surplus (profit)
      const surplus = parseFloat(order.executedSurplus || 0) / Math.pow(10, buyDecimals);
      const surplusUsd = surplus * 2000; // Rough USD estimate (assuming buying ETH)

      // Timestamps
      const createdAt = new Date(order.createdDate).getTime() / 1000;
      const settledAt = order.fulfilledDate ? new Date(order.fulfilledDate).getTime() / 1000 : 0;

      // Get token symbols
      const tokenInSymbol = getTokenSymbol(order.sellToken);
      const tokenOutSymbol = getTokenSymbol(order.buyToken);

      // Insert into database
      insertStmt.run(
        order.uid,
        order.settlement?.transactionHash || '',
        order.uid,
        order.owner,
        order.sellToken,
        tokenInSymbol,
        order.buyToken,
        tokenOutSymbol,
        amountIn,
        amountOut,
        executedAmountIn,
        executedAmountOut,
        executionPrice,
        surplus,
        surplusUsd,
        0,
        createdAt,
        settledAt,
        order.status || 'unknown',
        JSON.stringify(order)
      );

      inserted++;

      if (inserted % 1000 === 0) {
        console.log(`   ✅ Inserted ${inserted} orders`);
      }
    } catch (error) {
      console.error(`Error processing order ${order.uid}:`, error.message);
      skipped++;
    }
  }

  console.log(`\n✅ Processing complete`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped: ${skipped}`);

  return inserted;
}

// ============================================================================
// ANALYZE DATA
// ============================================================================

function analyzeData() {
  console.log('\n📈 Analyzing stored data...\n');

  // Total intents
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM intents').get();
  console.log(`📊 Total intents: ${totalResult.count}`);

  // By token pair
  console.log('\n📊 Top 10 token pairs:');
  const pairs = db.prepare(`
    SELECT
      token_in_symbol,
      token_out_symbol,
      COUNT(*) as count,
      AVG(execution_price) as avg_price,
      AVG(executed_surplus) as avg_surplus
    FROM intents
    GROUP BY token_in, token_out
    ORDER BY count DESC
    LIMIT 10
  `).all();

  pairs.forEach(p => {
    console.log(
      `  ${p.token_in_symbol}→${p.token_out_symbol}: ${p.count} orders, ` +
      `avg price: ${p.avg_price?.toFixed(4)}, ` +
      `avg surplus: ${p.avg_surplus?.toFixed(8)} ETH`
    );
  });

  // Win rate (profitable orders)
  const winRateResult = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) as profitable,
      ROUND(100 * SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as win_rate_percent
    FROM intents
  `).get();

  console.log(`\n📈 Win rate analysis:`);
  console.log(`  Total orders: ${winRateResult.total}`);
  console.log(`  Profitable: ${winRateResult.profitable}`);
  console.log(`  Win rate: ${winRateResult.win_rate_percent}%`);

  // Profit distribution
  const profitStats = db.prepare(`
    SELECT
      MIN(executed_surplus) as min_surplus,
      MAX(executed_surplus) as max_surplus,
      AVG(executed_surplus) as avg_surplus
    FROM intents
    WHERE executed_surplus > 0
  `).get();

  console.log(`\n💰 Profit statistics (profitable orders only):`);
  console.log(`  Min: ${(profitStats.min_surplus || 0).toFixed(8)} ETH`);
  console.log(`  Max: ${(profitStats.max_surplus || 0).toFixed(8)} ETH`);
  console.log(`  Avg: ${(profitStats.avg_surplus || 0).toFixed(8)} ETH`);

  // Recently settled
  const recent = db.prepare(`
    SELECT COUNT(*) as count
    FROM intents
    WHERE settled_at > (strftime('%s', 'now') - 86400)
  `).get();

  console.log(`\n⏱️  Recently settled (last 24h): ${recent.count} orders`);
}

// ============================================================================
// HELPERS
// ============================================================================

function getTokenSymbol(address) {
  const lowerAddr = address.toLowerCase();
  for (const [symbol, addr] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === lowerAddr) {
      return symbol;
    }
  }
  return address.slice(0, 6);
}

// ============================================================================
// EXPORT TO CSV
// ============================================================================

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
      new Date(o.created_at * 1000).toISOString(),
      new Date(o.settled_at * 1000).toISOString(),
    ].join(','))
  ].join('\n');

  const csvPath = path.join(__dirname, '../intents-export.csv');
  fs.writeFileSync(csvPath, csv);

  console.log(`✅ Exported to: ${csvPath}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║  FETCH INTENT DATA FROM COW PROTOCOL       ║
║  Historical data for model training        ║
╚════════════════════════════════════════════╝
  `);

  try {
    // Fetch
    const orders = await fetchIntents();

    // Process
    const inserted = processOrders(orders);

    // Analyze
    analyzeData();

    // Export
    exportToCsv();

    console.log(`
✅ COMPLETE
   Database: ${dbPath}
   Orders: ${inserted}

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
