#!/usr/bin/env node

/**
 * FETCH DEFILLAMA TRADING SIGNALS
 * Free tier only - no auth required
 * Grabs: DEX volumes, stablecoin supply, token prices, OI, TVL
 * Store for correlation with CoW intent data
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'https://api.llama.fi';
const RATE_LIMIT_MS = 1000; // 1 second between requests (safe for free tier)

// Token addresses we care about
const TOKENS = {
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};

const PROTOCOLS = ['uniswap', 'curve', 'balancer', 'aave', 'lido'];

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(2000 * (i + 1));
    }
  }
}

// ============================================================================
// 1. DEX VOLUMES
// ============================================================================

async function fetchDexVolumes() {
  console.log('📊 Fetching DEX volumes...');
  try {
    const data = await fetchWithRetry(`${API_BASE}/overview/dexs`);
    await delay(RATE_LIMIT_MS);

    return {
      timestamp: Date.now(),
      totalVolume: data.totalVolume || 0,
      totalVolume24h: data.totalVolume24h || 0,
      topDexs: (data.dexs || []).slice(0, 10).map(d => ({
        name: d.name,
        volume24h: d.volume24h || 0,
        chains: d.chains || []
      }))
    };
  } catch (error) {
    console.error('❌ DEX volumes error:', error.message);
    return null;
  }
}

// ============================================================================
// 2. STABLECOIN SUPPLY (Risk Regime Signal)
// ============================================================================

async function fetchStablecoinSupply() {
  console.log('📊 Fetching stablecoin supply...');
  try {
    // Get all stablecoins
    const data = await fetchWithRetry(`${API_BASE}/stablecoins`);
    await delay(RATE_LIMIT_MS);

    // Get historical supply
    const chartData = await fetchWithRetry(`${API_BASE}/stablecoincharts/all`);
    await delay(RATE_LIMIT_MS);

    const latest = chartData.slice(-1)[0] || [];
    const previous = chartData.slice(-2)[0] || [];

    return {
      timestamp: Date.now(),
      totalSupply: latest[1] || 0,
      previousSupply: previous[1] || 0,
      supplyChange: (latest[1] || 0) - (previous[1] || 0),
      supplyChangePercent: previous[1] ? (((latest[1] - previous[1]) / previous[1]) * 100) : 0,
      topStables: (data.peggedAssets || []).slice(0, 5).map(s => ({
        name: s.name,
        supply: s.supply || 0,
        chains: Object.keys(s.chainCirculating || {})
      }))
    };
  } catch (error) {
    console.error('❌ Stablecoin supply error:', error.message);
    return null;
  }
}

// ============================================================================
// 3. TOKEN PRICES & VOLATILITY
// ============================================================================

async function fetchTokenPrices() {
  console.log('📊 Fetching token prices...');
  try {
    const tokenList = Object.values(TOKENS).join(',');
    const current = await fetchWithRetry(`${API_BASE}/prices/current/${tokenList}`);
    await delay(RATE_LIMIT_MS);

    // Get 24h change
    const percentChange = await fetchWithRetry(`${API_BASE}/percentage/${tokenList}`);
    await delay(RATE_LIMIT_MS);

    const prices = {};
    for (const [symbol, address] of Object.entries(TOKENS)) {
      const key = `ethereum:${address}`;
      prices[symbol] = {
        price: current.coins?.[key]?.price || 0,
        change24h: percentChange.coins?.[key]?.['24h'] || 0,
        lastUpdate: current.coins?.[key]?.lastUpdate || 0
      };
    }

    return {
      timestamp: Date.now(),
      prices
    };
  } catch (error) {
    console.error('❌ Token prices error:', error.message);
    return null;
  }
}

// ============================================================================
// 4. PROTOCOL TVL (Liquidity Signal)
// ============================================================================

async function fetchProtocolTvl() {
  console.log('📊 Fetching protocol TVL...');
  try {
    const data = await fetchWithRetry(`${API_BASE}/protocols`);
    await delay(RATE_LIMIT_MS);

    const tvlData = {};
    for (const protocol of PROTOCOLS) {
      const proto = data.find(p => p.slug === protocol);
      if (proto) {
        tvlData[protocol] = {
          tvl: proto.tvl || 0,
          change24h: proto.change_1d || 0,
          chains: Object.keys(proto.chainTvls || {})
        };
      }
    }

    return {
      timestamp: Date.now(),
      protocolTvl: tvlData,
      totalDeFiTvl: data.reduce((sum, p) => sum + (p.tvl || 0), 0)
    };
  } catch (error) {
    console.error('❌ Protocol TVL error:', error.message);
    return null;
  }
}

// ============================================================================
// 5. YIELDS & APY (Capital Allocation Signal)
// ============================================================================

async function fetchYields() {
  console.log('📊 Fetching yields...');
  try {
    const data = await fetchWithRetry(`${API_BASE}/pools`);
    await delay(RATE_LIMIT_MS);

    // Find top yield opportunities
    const topYields = (data.data || [])
      .filter(p => p.apy && p.tvlUsd && p.tvlUsd > 100000)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 10)
      .map(p => ({
        pool: p.symbol || p.pool,
        apy: p.apy,
        tvl: p.tvlUsd,
        protocol: p.project
      }));

    const avgApy = (data.data || [])
      .filter(p => p.apy && p.tvlUsd && p.tvlUsd > 100000)
      .reduce((sum, p) => sum + p.apy, 0) / Math.max((data.data || []).length, 1);

    return {
      timestamp: Date.now(),
      avgApy,
      topYields
    };
  } catch (error) {
    console.error('❌ Yields error:', error.message);
    return null;
  }
}

// ============================================================================
// 6. PERPETUAL OPEN INTEREST (Leverage/Sentiment)
// ============================================================================

async function fetchOpenInterest() {
  console.log('📊 Fetching perpetual open interest...');
  try {
    const data = await fetchWithRetry(`${API_BASE}/overview/open-interest`);
    await delay(RATE_LIMIT_MS);

    const topExchanges = (data.protocols || [])
      .sort((a, b) => b.openInterest - a.openInterest)
      .slice(0, 5)
      .map(ex => ({
        name: ex.name,
        openInterest: ex.openInterest,
        revenue24h: ex.revenue24h || 0
      }));

    return {
      timestamp: Date.now(),
      totalOI: data.protocols?.reduce((sum, p) => sum + (p.openInterest || 0), 0) || 0,
      topExchanges
    };
  } catch (error) {
    console.error('❌ Open interest error:', error.message);
    return null;
  }
}

// ============================================================================
// 7. DEX VOLUMES BY PROTOCOL
// ============================================================================

async function fetchDexProtocols() {
  console.log('📊 Fetching DEX protocols...');
  try {
    const dexList = ['uniswap', 'curve', 'balancer', 'sushiswap', 'pancakeswap'];
    const dexData = {};

    for (const dex of dexList) {
      try {
        const data = await fetchWithRetry(`${API_BASE}/summary/dexs/${dex}`);
        await delay(RATE_LIMIT_MS);

        dexData[dex] = {
          volume24h: data.volume24h || 0,
          totalVolume: data.totalVolume || 0,
          change24h: data.change_1d || 0
        };
      } catch (e) {
        console.warn(`  ⚠️  Could not fetch ${dex}`);
      }
    }

    return {
      timestamp: Date.now(),
      dexVolumes: dexData
    };
  } catch (error) {
    console.error('❌ DEX protocols error:', error.message);
    return null;
  }
}

// ============================================================================
// AGGREGATE & SAVE
// ============================================================================

async function fetchAllSignals() {
  console.log(`
╔════════════════════════════════════════════╗
║  FETCH DEFILLAMA SIGNALS                   ║
║  Free tier data collection                 ║
╚════════════════════════════════════════════╝
  `);

  const signals = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    signals: {}
  };

  // Fetch all signals
  const dexVolumes = await fetchDexVolumes();
  const stableSupply = await fetchStablecoinSupply();
  const tokenPrices = await fetchTokenPrices();
  const protocolTvl = await fetchProtocolTvl();
  const yields = await fetchYields();
  const openInterest = await fetchOpenInterest();
  const dexProtocols = await fetchDexProtocols();

  // Store what we got
  if (dexVolumes) signals.signals.dexVolumes = dexVolumes;
  if (stableSupply) signals.signals.stablecoinSupply = stableSupply;
  if (tokenPrices) signals.signals.tokenPrices = tokenPrices;
  if (protocolTvl) signals.signals.protocolTvl = protocolTvl;
  if (yields) signals.signals.yields = yields;
  if (openInterest) signals.signals.openInterest = openInterest;
  if (dexProtocols) signals.signals.dexVolumes = dexProtocols;

  // Save to file
  const outputPath = path.join(__dirname, '../signals-latest.json');
  fs.writeFileSync(outputPath, JSON.stringify(signals, null, 2));

  // Also append to historical log
  const historyPath = path.join(__dirname, '../signals-history.jsonl');
  fs.appendFileSync(historyPath, JSON.stringify(signals) + '\n');

  console.log(`
✅ SIGNALS COLLECTED

Saved to:
  • signals-latest.json (current snapshot)
  • signals-history.jsonl (append-only history)

Data collected:
  ✓ DEX volumes
  ✓ Stablecoin supply (risk regime)
  ✓ Token prices (USDC/USDT/DAI/WETH)
  ✓ Protocol TVL (liquidity)
  ✓ Yields (capital allocation)
  ✓ Open interest (leverage sentiment)
  ✓ DEX protocol volumes

Next: Correlate with intents-mock.json to find which signals matter.
  `);

  return signals;
}

// ============================================================================
// MAIN
// ============================================================================

await fetchAllSignals().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
