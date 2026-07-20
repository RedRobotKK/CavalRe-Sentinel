#!/usr/bin/env node

/**
 * GENERATE MOCK INTENT DATA (SIMPLE VERSION)
 * No database dependency - pure JSON output
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateIntents(count = 10000) {
  console.log(`📊 Generating ${count.toLocaleString()} mock intents...\n`);

  const intents = [];
  const now = Math.floor(Date.now() / 1000);
  const oneWeekAgo = now - (7 * 86400);

  for (let i = 0; i < count; i++) {
    const [tokenIn, tokenOut] = POPULAR_PAIRS[Math.floor(Math.random() * POPULAR_PAIRS.length)];
    const createdAt = Math.floor(randomBetween(oneWeekAgo, now));
    const settledAt = createdAt + Math.floor(randomBetween(2, 60));

    let amountIn, expectedAmountOut;
    if (tokenIn === TOKENS.USDC || tokenIn === TOKENS.USDT || tokenIn === TOKENS.DAI) {
      amountIn = randomBetween(100, 10000);
      expectedAmountOut = amountIn / 2000;
    } else {
      amountIn = randomBetween(0.1, 5);
      expectedAmountOut = amountIn * 2000;
    }

    const slippage = randomBetween(0.001, 0.005);
    const executedAmountIn = amountIn;
    const executedAmountOut = expectedAmountOut * (1 - slippage);
    const executionPrice = executedAmountOut / executedAmountIn;

    const surplusPercentage = randomBetween(0, 0.2);
    const executedSurplus = expectedAmountOut * surplusPercentage;
    const isWon = Math.random() < 0.75;
    const finalSurplus = isWon ? executedSurplus : -0.001;

    intents.push({
      id: `0x${Math.random().toString(16).slice(2)}${i}`,
      settlement_tx: `0x${Math.random().toString(16).slice(2)}`,
      order_uid: `0x${Math.random().toString(16).slice(2)}`,
      token_in: tokenIn,
      token_in_symbol: TOKEN_SYMBOLS[tokenIn],
      token_out: tokenOut,
      token_out_symbol: TOKEN_SYMBOLS[tokenOut],
      amount_in: parseFloat(amountIn.toFixed(6)),
      amount_out: parseFloat(expectedAmountOut.toFixed(8)),
      executed_amount_in: parseFloat(executedAmountIn.toFixed(6)),
      executed_amount_out: parseFloat(executedAmountOut.toFixed(8)),
      execution_price: parseFloat(executionPrice.toFixed(8)),
      executed_surplus: parseFloat(finalSurplus.toFixed(8)),
      created_at: createdAt,
      settled_at: settledAt,
      status: isWon ? 'fulfilled' : 'cancelled'
    });

    if ((i + 1) % 1000 === 0) {
      console.log(`   ✅ Generated ${(i + 1).toLocaleString()} intents`);
    }
  }

  console.log(`\n✅ Generated ${intents.length.toLocaleString()} intents`);
  return intents;
}

function analyzeData(intents) {
  console.log('\n📊 Analyzing generated data...\n');

  // Count
  console.log(`📈 Total intents: ${intents.length.toLocaleString()}`);

  // By pair
  const pairMap = {};
  intents.forEach(intent => {
    const key = `${intent.token_in_symbol}→${intent.token_out_symbol}`;
    if (!pairMap[key]) {
      pairMap[key] = { count: 0, totalSurplus: 0, prices: [] };
    }
    pairMap[key].count++;
    pairMap[key].totalSurplus += intent.executed_surplus || 0;
    pairMap[key].prices.push(intent.execution_price);
  });

  const pairs = Object.entries(pairMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  console.log('\n🏆 Top 10 token pairs:');
  pairs.forEach((p, i) => {
    const avgPrice = (p[1].prices.reduce((a, b) => a + b) / p[1].prices.length).toFixed(6);
    const avgSurplus = (p[1].totalSurplus / p[1].count).toFixed(6);
    console.log(`   ${i + 1}. ${p[0]}: ${p[1].count} orders, ${avgSurplus} ETH avg surplus`);
  });

  // Win rate
  const profitable = intents.filter(i => i.executed_surplus > 0).length;
  const winRate = ((profitable / intents.length) * 100).toFixed(1);
  console.log(`\n💰 Profitability:`);
  console.log(`   Total orders: ${intents.length}`);
  console.log(`   Profitable: ${profitable}`);
  console.log(`   Win rate: ${winRate}%`);

  const profitableOnly = intents.filter(i => i.executed_surplus > 0);
  const minSurplus = Math.min(...profitableOnly.map(i => i.executed_surplus));
  const maxSurplus = Math.max(...profitableOnly.map(i => i.executed_surplus));
  const avgSurplus = profitableOnly.reduce((a, b) => a + b.executed_surplus, 0) / profitableOnly.length;

  console.log(`   Min surplus: ${minSurplus.toFixed(8)} ETH`);
  console.log(`   Avg surplus: ${avgSurplus.toFixed(8)} ETH`);
  console.log(`   Max surplus: ${maxSurplus.toFixed(8)} ETH`);
}

function exportToJson(intents) {
  console.log('\n💾 Exporting to JSON...');
  const jsonPath = path.join(__dirname, '../data/intents-mock.json');
  fs.writeFileSync(jsonPath, JSON.stringify(intents, null, 2));
  console.log(`✅ Exported to: ${jsonPath}\n`);
  return jsonPath;
}

function exportToCsv(intents) {
  console.log('💾 Exporting to CSV...');
  const csv = [
    ['Order UID', 'Token In', 'Token Out', 'Amount In', 'Amount Out', 'Price', 'Surplus ETH', 'Created', 'Settled', 'Status'].join(','),
    ...intents.map(o => [
      o.order_uid.slice(0, 16) + '...',
      o.token_in_symbol,
      o.token_out_symbol,
      o.amount_in.toFixed(2),
      o.executed_amount_out.toFixed(4),
      o.execution_price.toFixed(6),
      (o.executed_surplus || 0).toFixed(8),
      new Date(o.created_at * 1000).toISOString().split('T')[0],
      new Date(o.settled_at * 1000).toISOString().split('T')[0],
      o.status
    ].join(','))
  ].join('\n');

  const csvPath = path.join(__dirname, '../data/intents-mock.csv');
  fs.writeFileSync(csvPath, csv);
  console.log(`✅ Exported to: ${csvPath}\n`);
}

async function main() {
  console.log(`
╔════════════════════════════════════════════╗
║  GENERATE MOCK INTENT DATA (SIMPLE)        ║
║  Realistic synthetic data for training     ║
╚════════════════════════════════════════════╝
  `);

  try {
    const intents = generateIntents(10000);
    analyzeData(intents);
    const jsonPath = exportToJson(intents);
    exportToCsv(intents);

    console.log(`
✅ COMPLETE

Files generated:
  • intents-mock.json (full dataset for training)
  • intents-mock.csv (sample for review)

Ready to:
  1. Train model: npm run train:model
  2. Backtest: npm run backtest
  3. Deploy: npm run start:mainnet

Note: This is synthetic data. For real data:
  • DefiLlama API: https://defillama.com/ (solid for protocol data)
  • Dune Analytics: https://dune.com (SQL queries via browser)
  • CoW Explorer: https://explorer.cow.fi (web UI exploration)
    `);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

await main();
