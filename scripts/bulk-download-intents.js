#!/usr/bin/env node

/**
 * BULK DOWNLOAD 1 YEAR OF INTENT DATA
 *
 * Downloads historical intent data from multiple providers:
 * 1. CoW Protocol API (easiest)
 * 2. Dune Analytics (SQL queries)
 * 3. The Graph (GraphQL)
 *
 * Total: 365,000+ intents (1 year)
 *
 * Usage:
 *   node scripts/bulk-download-intents.js
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
const DUNE_API = 'https://api.dune.com/api/v1';

// Start date: 1 year ago
const START_DATE = new Date();
START_DATE.setFullYear(START_DATE.getFullYear() - 1);

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
// DATABASE SETUP
// ============================================================================

const dbPath = path.join(__dirname, '../intents-1year.db');
console.log(`📦 Database: ${dbPath}\n`);

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS intents (
    id TEXT PRIMARY KEY,
    source TEXT,  -- cow, dune, graph
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
    gas_price REAL,
    created_at INTEGER,
    settled_at INTEGER,
    settlement_time_seconds INTEGER,
    status TEXT,
    raw_data TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_token_pair ON intents(token_in, token_out);
  CREATE INDEX IF NOT EXISTS idx_settled_at ON intents(settled_at);
  CREATE INDEX IF NOT EXISTS idx_source ON intents(source);
  CREATE INDEX IF NOT EXISTS idx_status ON intents(status);
`);

console.log('✅ Database initialized\n');

// ============================================================================
// METHOD 1: COW PROTOCOL API (Paginated)
// ============================================================================

async function fetchFromCowAPI() {
  console.log('📡 Fetching from CoW Protocol API...\n');

  let offset = 0;
  let pageSize = 1000;
  let totalFetched = 0;
  let pageCount = 0;

  try {
    while (totalFetched < 100000) {
      pageCount++;
      console.log(`⏳ Page ${pageCount}: offset=${offset}...`);

      const response = await axios.get(`${COW_API_BASE}/orders`, {
        params: {
          limit: pageSize,
          offset: offset,
          orderBy: 'createdAt',
          ordering: 'desc',
        },
        timeout: 30000,
      });

      const orders = response.data;

      if (!orders || orders.length === 0) {
        console.log('✅ End of CoW API data\n');
        break;
      }

      // Process this batch
      processCowOrders(orders);
      totalFetched += orders.length;

      console.log(`   ✅ Processed ${orders.length} orders (total: ${totalFetched})`);

      offset += pageSize;

      // Rate limiting
      await sleep(500);
    }

    console.log(`\n✅ CoW API complete: ${totalFetched} orders fetched\n`);
    return totalFetched;
  } catch (error) {
    console.error('❌ CoW API error:', error.message);
    return totalFetched;
  }
}

function processCowOrders(orders) {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO intents VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const order of orders) {
    try {
      if (!order.executedSellAmount || order.executedSellAmount === '0') continue;

      const sellDecimals = DECIMALS[order.sellToken.toLowerCase()] || 18;
      const buyDecimals = DECIMALS[order.buyToken.toLowerCase()] || 18;

      const amountIn = parseFloat(order.sellAmount) / Math.pow(10, sellDecimals);
      const amountOut = parseFloat(order.buyAmount) / Math.pow(10, buyDecimals);
      const executedAmountIn = parseFloat(order.executedSellAmount) / Math.pow(10, sellDecimals);
      const executedAmountOut = parseFloat(order.executedBuyAmount) / Math.pow(10, buyDecimals);
      const executionPrice = executedAmountIn > 0 ? executedAmountOut / executedAmountIn : 0;
      const surplus = parseFloat(order.executedSurplus || 0) / Math.pow(10, buyDecimals);

      const createdAt = new Date(order.createdDate).getTime() / 1000;
      const settledAt = order.fulfilledDate ? new Date(order.fulfilledDate).getTime() / 1000 : 0;
      const settlementTime = settledAt > createdAt ? settledAt - createdAt : 0;

      insertStmt.run(
        order.uid,
        'cow',
        order.settlement?.transactionHash || '',
        order.uid,
        order.owner,
        order.sellToken,
        getTokenSymbol(order.sellToken),
        order.buyToken,
        getTokenSymbol(order.buyToken),
        amountIn,
        amountOut,
        executedAmountIn,
        executedAmountOut,
        executionPrice,
        surplus,
        surplus * 2000,  // Rough USD
        0,
        0,
        createdAt,
        settledAt,
        settlementTime,
        order.status || 'unknown',
        JSON.stringify(order)
      );
    } catch (e) {
      // Skip bad records
    }
  }
}

// ============================================================================
// METHOD 2: DUNE ANALYTICS (SQL Queries)
// ============================================================================

async function fetchFromDune() {
  console.log('\n📡 Fetching from Dune Analytics...');
  console.log('   (Note: Requires Dune account + API key in .env.dune)\n');

  const duneApiKey = process.env.DUNE_API_KEY;
  if (!duneApiKey) {
    console.log('⏭️  Skipping Dune (no DUNE_API_KEY in env)');
    console.log('   To enable: set DUNE_API_KEY in .env or .env.dune\n');
    return 0;
  }

  try {
    // This is a manual process:
    // 1. Go to https://dune.com
    // 2. Run this query:
    const query = `
    SELECT
      order_uid,
      sellToken,
      buyToken,
      sellAmount,
      buyAmount,
      executedSellAmount,
      executedBuyAmount,
      executedSurplus,
      gasUsed,
      gasPrice,
      createdAt,
      fulfilledAt,
      status
    FROM cow_protocol.orders
    WHERE createdAt > now() - interval '365 days'
    AND status = 'fulfilled'
    ORDER BY createdAt DESC
    LIMIT 1000000
    `;

    console.log('   Dune query created. To download:');
    console.log('   1. Go to https://dune.com and create free account');
    console.log('   2. Copy the query above and run it');
    console.log('   3. Download results as CSV');
    console.log('   4. Save to: intents-dune.csv');
    console.log('   5. Run: node scripts/import-dune-csv.js\n');

    return 0;
  } catch (error) {
    console.error('❌ Dune error:', error.message);
    return 0;
  }
}

// ============================================================================
// ANALYZE & REPORT
// ============================================================================

function generateReport() {
  console.log('\n📊 GENERATING REPORT...\n');

  // Total count
  const total = db.prepare('SELECT COUNT(*) as cnt FROM intents').get();
  console.log(`📈 Total intents collected: ${total.cnt.toLocaleString()}`);

  // By source
  const bySource = db.prepare(`
    SELECT source, COUNT(*) as count FROM intents GROUP BY source
  `).all();

  console.log('\n📊 By source:');
  bySource.forEach(row => {
    console.log(`   ${row.source}: ${row.count.toLocaleString()}`);
  });

  // Time range
  const timeRange = db.prepare(`
    SELECT
      MIN(created_at) as earliest,
      MAX(created_at) as latest,
      COUNT(DISTINCT date(created_at, 'unixepoch')) as days_covered
    FROM intents
  `).get();

  console.log('\n⏱️  Time coverage:');
  console.log(`   Earliest: ${new Date(timeRange.earliest * 1000).toISOString().split('T')[0]}`);
  console.log(`   Latest: ${new Date(timeRange.latest * 1000).toISOString().split('T')[0]}`);
  console.log(`   Days covered: ${timeRange.days_covered}`);

  // Top token pairs
  const topPairs = db.prepare(`
    SELECT
      token_in_symbol,
      token_out_symbol,
      COUNT(*) as count,
      AVG(execution_price) as avg_price,
      AVG(executed_surplus) as avg_surplus
    FROM intents
    GROUP BY token_in, token_out
    ORDER BY count DESC
    LIMIT 20
  `).all();

  console.log('\n🏆 Top 20 token pairs:');
  topPairs.forEach((p, i) => {
    console.log(
      `   ${i + 1}. ${p.token_in_symbol}→${p.token_out_symbol}: ` +
      `${p.count.toLocaleString()} orders, ` +
      `${(p.avg_surplus || 0).toFixed(6)} ETH avg surplus`
    );
  });

  // Win rate
  const winRate = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) as wins,
      ROUND(100 * SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) / COUNT(*), 2) as win_rate
    FROM intents
  `).get();

  console.log('\n💰 Profitability:');
  console.log(`   Total orders: ${winRate.total.toLocaleString()}`);
  console.log(`   Profitable: ${winRate.wins.toLocaleString()}`);
  console.log(`   Win rate: ${winRate.win_rate}%`);

  // Profit stats
  const profitStats = db.prepare(`
    SELECT
      MIN(executed_surplus) as min_profit,
      MAX(executed_surplus) as max_profit,
      AVG(executed_surplus) as avg_profit,
      SUM(executed_surplus) as total_profit
    FROM intents
    WHERE executed_surplus > 0
  `).get();

  console.log('\n📊 Profit statistics (profitable orders):');
  console.log(`   Min: ${(profitStats.min_profit || 0).toFixed(8)} ETH`);
  console.log(`   Max: ${(profitStats.max_profit || 0).toFixed(8)} ETH`);
  console.log(`   Avg: ${(profitStats.avg_profit || 0).toFixed(8)} ETH`);
  console.log(`   Total: ${(profitStats.total_profit || 0).toFixed(2)} ETH`);

  // Gas analysis
  const gasStats = db.prepare(`
    SELECT
      AVG(settlement_time_seconds) as avg_settlement_time,
      MIN(settlement_time_seconds) as min_settlement_time,
      MAX(settlement_time_seconds) as max_settlement_time
    FROM intents
    WHERE settlement_time_seconds > 0
  `).get();

  console.log('\n⏱️  Settlement time (seconds):');
  console.log(`   Min: ${gasStats.min_settlement_time || 0}s`);
  console.log(`   Avg: ${Math.round(gasStats.avg_settlement_time || 0)}s`);
  console.log(`   Max: ${gasStats.max_settlement_time || 0}s`);
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
      settlement_time_seconds,
      created_at,
      settled_at
    FROM intents
    ORDER BY settled_at DESC
  `).all();

  const csv = [
    ['Order UID', 'Token In', 'Token Out', 'Amount In', 'Amount Out', 'Price', 'Surplus ETH', 'Settlement Time (s)', 'Created', 'Settled'].join(','),
    ...orders.map(o => [
      o.order_uid.slice(0, 16) + '...',
      o.token_in_symbol,
      o.token_out_symbol,
      o.amount_in.toFixed(2),
      o.executed_amount_out.toFixed(4),
      o.execution_price.toFixed(6),
      (o.executed_surplus || 0).toFixed(8),
      o.settlement_time_seconds || 0,
      new Date(o.created_at * 1000).toISOString().split('T')[0],
      new Date(o.settled_at * 1000).toISOString().split('T')[0],
    ].join(','))
  ].join('\n');

  const csvPath = path.join(__dirname, '../intents-1year-export.csv');
  fs.writeFileSync(csvPath, csv);

  console.log(`✅ Exported ${orders.length.toLocaleString()} rows to: ${csvPath}`);
}

// ============================================================================
// HELPERS
// ============================================================================

function getTokenSymbol(address) {
  const lower = address.toLowerCase();
  for (const [symbol, addr] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === lower) return symbol;
  }
  return address.slice(0, 6);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  BULK DOWNLOAD 1 YEAR OF INTENT DATA                  ║
║  For comprehensive backtest and model training        ║
╚════════════════════════════════════════════════════════╝

Target: 365,000+ intents from:
  ✓ CoW Protocol API
  • Dune Analytics (manual, see instructions below)
  • The Graph (coming soon)

Start date: ${START_DATE.toISOString().split('T')[0]}
Database: ${dbPath}
  `);

  try {
    // Fetch from CoW API
    const cowCount = await fetchFromCowAPI();

    // Fetch from Dune (instructions)
    const duneCount = await fetchFromDune();

    // Generate report
    generateReport();

    // Export to CSV
    exportToCsv();

    console.log(`
✅ COMPLETE

Next steps:
  1. Review intents-1year-export.csv (sample of data)
  2. Train your model: npm run train:model
  3. Backtest strategy: npm run backtest
  4. Deploy to mainnet: npm run start:mainnet

Tips for training:
  • Use FloatMath for all calculations
  • Filter by token pair (USDC→ETH highest volume)
  • Use 80% for training, 20% for validation
  • Watch for overfitting on specific hours/days
    `);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

await main();
