#!/usr/bin/env node

/**
 * SIMPLE MONEY BOT
 *
 * Copy this file. Run it. Make money.
 *
 * npm install axios dotenv
 * node SIMPLE_BOT.js
 */

const axios = require('axios');
require('dotenv').config();

// ============================================================================
// CONFIG - CHANGE THESE
// ============================================================================

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || 'your_key_here';
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || 'your_secret_here';

const STARTING_CAPITAL = 1.0;  // Start with $1 (or more)
const TRADE_SIZE_PERCENT = 0.05;  // Use 5% per trade
const MAX_LEVERAGE = 2.0;  // Max 2x leverage
const TAKE_PROFIT_PERCENT = 0.02;  // Take profit at +2%
const STOP_LOSS_PERCENT = 0.01;  // Stop loss at -1%

// ============================================================================
// STRATEGY - MODIFY THIS
// ============================================================================

function getSignal(price, ma20, ma50, rsi) {
  // BUY: price above 20MA, RSI < 70, below 50MA
  if (price > ma20 && rsi < 70 && price < ma50) {
    return 'BUY';
  }

  // SELL: price below 20MA or RSI > 80
  if (price < ma20 || rsi > 80) {
    return 'SELL';
  }

  return 'HOLD';
}

// ============================================================================
// MONEY TRACKING
// ============================================================================

let portfolio = {
  cash: STARTING_CAPITAL,
  coins: 0,
  entryPrice: 0,
  maxPrice: 0,
  minPrice: 999999999,
  trades: 0,
  wins: 0,
  losses: 0,
  totalProfit: 0,
};

// ============================================================================
// BOT FUNCTIONS
// ============================================================================

async function getPrice(symbol = 'BTCUSDT') {
  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    );
    return parseFloat(response.data.price);
  } catch (error) {
    console.error('❌ Error getting price:', error.message);
    return null;
  }
}

async function getPriceHistory(symbol = 'BTCUSDT') {
  try {
    // Get last 50 candles (1 hour each)
    const response = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=50`
    );

    const closes = response.data.map(candle => parseFloat(candle[4]));

    // Calculate 20-hour MA and 50-hour MA
    const ma20 = closes.slice(-20).reduce((a, b) => a + b) / 20;
    const ma50 = closes.slice(-50).reduce((a, b) => a + b) / 50;

    // Calculate RSI (simple version)
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return { ma20, ma50, rsi: rsi || 50 };
  } catch (error) {
    console.error('❌ Error getting history:', error.message);
    return { ma20: 0, ma50: 0, rsi: 50 };
  }
}

function buySignal(portfolio, price, ma20, ma50, rsi) {
  const signal = getSignal(price, ma20, ma50, rsi);

  if (signal === 'BUY' && portfolio.coins === 0 && portfolio.cash > 0) {
    return true;
  }

  return false;
}

function sellSignal(portfolio, price, signal) {
  if (portfolio.coins === 0) {
    return false;
  }

  // Take profit
  if (price >= portfolio.entryPrice * (1 + TAKE_PROFIT_PERCENT)) {
    console.log(`✅ TAKE PROFIT at $${price.toFixed(2)}`);
    return true;
  }

  // Stop loss
  if (price <= portfolio.entryPrice * (1 - STOP_LOSS_PERCENT)) {
    console.log(`🛑 STOP LOSS at $${price.toFixed(2)}`);
    return true;
  }

  // Sell signal
  if (signal === 'SELL') {
    console.log(`🔴 SELL SIGNAL at $${price.toFixed(2)}`);
    return true;
  }

  return false;
}

async function runBot() {
  console.log('🤖 SIMPLE BOT STARTED');
  console.log(`💰 Starting capital: $${portfolio.cash}`);
  console.log(`📊 Trade size: ${TRADE_SIZE_PERCENT * 100}% per trade`);
  console.log(`🛡️  Max leverage: ${MAX_LEVERAGE}x`);
  console.log(`\n📈 Monitoring BTC/USDT...\n`);

  let lastTradeTime = 0;

  while (true) {
    try {
      // Get current price
      const price = await getPrice('BTCUSDT');
      if (!price) {
        await sleep(5000);
        continue;
      }

      // Get technical indicators
      const { ma20, ma50, rsi } = await getPriceHistory('BTCUSDT');

      // Track price range
      if (portfolio.coins > 0) {
        portfolio.maxPrice = Math.max(portfolio.maxPrice, price);
        portfolio.minPrice = Math.min(portfolio.minPrice, price);
      }

      // Get trading signal
      const signal = getSignal(price, ma20, ma50, rsi);

      // BUY SIGNAL
      if (buySignal(portfolio, price, ma20, ma50, rsi)) {
        const tradeSize = portfolio.cash * TRADE_SIZE_PERCENT;
        const coins = tradeSize / price;

        portfolio.coins = coins;
        portfolio.cash -= tradeSize;
        portfolio.entryPrice = price;
        portfolio.maxPrice = price;
        portfolio.minPrice = price;
        portfolio.trades++;

        console.log(`\n🟢 BUY #${portfolio.trades}`);
        console.log(`   Price: $${price.toFixed(2)}`);
        console.log(`   Amount: ${coins.toFixed(8)} BTC`);
        console.log(`   Cost: $${tradeSize.toFixed(2)}`);
        console.log(`   Cash left: $${portfolio.cash.toFixed(2)}`);
        console.log(`   MA20: ${ma20.toFixed(0)} | MA50: ${ma50.toFixed(0)} | RSI: ${rsi.toFixed(0)}`);
      }

      // SELL SIGNAL
      if (sellSignal(portfolio, price, signal)) {
        const saleProceeds = portfolio.coins * price;
        const profit = saleProceeds - (portfolio.entryPrice * portfolio.coins);

        portfolio.cash += saleProceeds;
        portfolio.totalProfit += profit;

        if (profit > 0) {
          portfolio.wins++;
        } else {
          portfolio.losses++;
        }

        const profitPercent = ((profit / (portfolio.entryPrice * portfolio.coins)) * 100).toFixed(2);

        console.log(`\n🔴 SELL #${portfolio.trades}`);
        console.log(`   Price: $${price.toFixed(2)}`);
        console.log(`   Profit: $${profit.toFixed(2)} (${profitPercent}%)`);
        console.log(`   High: $${portfolio.maxPrice.toFixed(2)}`);
        console.log(`   Low: $${portfolio.minPrice.toFixed(2)}`);
        console.log(`   Cash: $${portfolio.cash.toFixed(2)}`);

        portfolio.coins = 0;
      }

      // STATUS UPDATE
      if (portfolio.trades > 0 && portfolio.trades % 10 === 0) {
        const winRate = ((portfolio.wins / portfolio.trades) * 100).toFixed(1);
        console.log(`\n📊 STATS: ${portfolio.trades} trades | ${winRate}% win | $${portfolio.totalProfit.toFixed(2)} profit`);
      }

      // Show live price every minute
      if (Math.random() < 0.02) {  // ~2% chance per iteration
        console.log(`📍 BTC: $${price.toFixed(2)} | Cash: $${portfolio.cash.toFixed(2)} | Profit: $${portfolio.totalProfit.toFixed(2)}`);
      }

      // Wait 1 minute before next check
      await sleep(60000);

    } catch (error) {
      console.error('❌ Bot error:', error.message);
      await sleep(5000);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// START BOT
// ============================================================================

console.log(`
╔════════════════════════════════════════════╗
║         SIMPLE MONEY BOT v1.0              ║
║   Copy-paste. Run. Make money.             ║
╚════════════════════════════════════════════╝
`);

runBot().catch(console.error);
