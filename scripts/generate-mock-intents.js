#!/usr/bin/env node

/**
 * GENERATE MOCK INTENT DATA FOR TRAINING
 *
 * Creates realistic synthetic intent data for testing and model training.
 * Based on real CoW Protocol patterns.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIG
// ============================================================================

const TOKENS = {
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};

const TOKEN_SYMBOLS = {
  [TOKENS.USDC]: 'USDC',
  [TOKENS.USDT]: 'USDT',
  [TOKENS.DAI]: 'DAI',
  [TOKENS.WETH]: 'WETH',
};

const POPULAR_PAIRS = [
  [TOKENS.USDC, TOKENS.WETH],
  [TOKENS.WETH, TOKENS.USDC],
  [TOKENS.DAI, TOKENS.USDC],
  [TOKENS.USDC, TOKENS.DAI],
  [TOKENS.USDT, TOKENS.USDC],
  [TOKENS.USDC, TOKENS.USDT],
  [TOKENS.DAI, TOKENS.WETH],
  [TOKENS.WETH, TOKENS.DAI],
];

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
// DATA GENERATION
// ============================================================================

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateIntents(count = 10000) {
  console.log(`📊 Generating ${count.toLocaleString()} mock intents...\n`);

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO intents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const now = Math.floor(Date.now() / 1000);
  const oneWeekAgo = now - (7 * 86400);

  for (let i = 0; i < count; i++) {
    // Random token pair
    const [tokenIn, tokenOut] = POPULAR_PAIRS[Math.floor(Math.random() * POPULAR_PAIRS.length)];

    // Random timestamps (last week)
    const createdAt = Math.floor(randomBetween(oneWeekAgo, now));
    const settledAt = createdAt + Math.floor(randomBetween(2, 60)); // 2-60 seconds to settle

    // Random amounts
    let amountIn, expectedAmountOut;
    if (tokenIn === TOKENS.USDC || tokenIn === TOKENS.USDT || tokenIn === TOKENS.DAI) {
      amountIn = randomBetween(100, 10000); // $100-$10k
      expectedAmountOut = amountIn / 2000; // Rough ETH price
    } else {
      amountIn = randomBetween(0.1, 5); // 0.1-5 ETH
      expectedAmountOut = amountIn * 2000;
    }

    // Execution with slippage (0.1-0.5%)
    const slippage = randomBetween(0.001, 0.005);
    const executedAmountIn = amountIn;
    const executedAmountOut = expectedAmountOut * (1 - slippage);

    // Execution price
    const executionPrice = executedAmountOut / executedAmountIn;

    // Solver surplus (0-20% of value)
    const surplusPercentage = randomBetween(0, 0.2);
    const executedSurplus = expectedAmountOut * surplusPercentage;

    // 75% of orders are profitable (realistic)
    const isWon = Math.random() < 0.75;
    const finalSurplus = isWon ? executedSurplus : -0.001; // Small loss if not won

    insertStmt.run(
      `0x${Math.random().toString(16).slice(2)}${i}`,
      `0x${Math.random().toString(16).slice(2)}`,
      `0x${Math.random().toString(16).slice(2)}`,
      tokenIn,
      TOKEN_SYMBOLS[tokenIn],
      tokenOut,
      TOKEN_SYMBOLS[tokenOut],
      amountIn,
      expectedAmountOut,
      executedAmountIn,
      executedAmountOut,
      executionPrice,
      finalSurplus,
      createdAt,
      settledAt,
      isWon ? 'fulfilled' : 'cancelled'
    );

    inserted++;

    if (inserted % 1000 === 0) {
      console.log(`   ✅ Generated ${inserted.toLocaleString()} intents`);
    }
  }

  console.log(`\n✅ Generated ${inserted.toLocaleString()} intents`);
  return inserted;
}

function analyzeData() {
  console.log('\n📊 Analyzing generated data...\n');

  const total = db.prepare('SELECT COUNT(*) as cnt FROM intents').get();
  console.log(`📈 Total intents: ${total.cnt.toLocaleString()}`);

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
    LIMIT 10
  `).all();

  console.log('\n🏆 Top 10 token pairs:');
  topPairs.forEach((p, i) => {
    const surplus = (p.avg_surplus || 0).toFixed(6);
    console.log(`   ${i + 1}. ${p.token_in_symbol}→${p.token_out_symbol}: ${p.count} orders, ${surplus} ETH avg surplus`);
  });

  const profitStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN executed_surplus > 0 THEN 1 ELSE 0 END) as wins,
      AVG(executed_surplus) as avg_surplus,
      MIN(executed_surplus) as min_surplus,
      MAX(executed_surplus) as max_surplus
    FROM intents
  `).get();

  console.log(`\n💰 Profitability:`);
  console.log(`   Total orders: ${profitStats.total}`);
  console.log(`   Profitable: ${profitStats.wins}`);
  if (profitStats.total > 0) {
    const winRate = ((profitStats.wins / profitStats.total) * 100).toFixed(1);
    console.log(`   Win rate: ${winRate}%`);
  }
  console.log(`   Min surplus: ${(profitStats.min_surplus || 0).toFixed(6)} ETH`);
  console.log(`   Avg surplus: ${(profitStats.avg_surplus || 0).toFixed(6)} ETH`);
  console.log(`   Max surplus: ${(profitStats.max_surplus || 0).toFixed(6)} ETH`);
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
  console.log(`✅ Exported ${orders.length.toLocaleString()} rows to: ${csvPath}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║  GENERATE MOCK INTENT DATA                 ║
║  Realistic synthetic data for training     ║
╚════════════════════════════════════════════╝
  `);

  try {
    // Generate 10,000 realistic mock intents
    const count = generateIntents(10000);

    // Analyze
    analyzeData();

    // Export
    exportToCsv();

    console.log(`
✅ COMPLETE

Database: ${dbPath}
Training data: ${count.toLocaleString()} intents

Ready to use:
  1. Train model: npm run train:model
  2. Backtest: npm run backtest
  3. Deploy: npm run start:mainnet

Note: This is synthetic data for testing. For production, use real data from:
  - Dune Analytics (SQL queries)
  - The Graph (GraphQL)
  - CoW Protocol API (when network accessible)
    `);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

await main();
