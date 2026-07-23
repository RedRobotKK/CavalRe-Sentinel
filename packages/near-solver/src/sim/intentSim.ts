/**
 * Intent request simulator — protocol-valid quote_requests + coherent USD mids.
 *
 * Tier A research tool. Does not prove live edge.
 * Market averages + multiplicative noise; deterministic when seeded.
 */

import type { QuoteRequestEvent } from '../codec.js';
import { MAINNET_REGISTRY, USDC_NEAR, USDT_NEAR, WNEAR } from '../mainnetConfig.js';

export interface MarketAverages {
  /** USD mid per defuse asset id */
  midsUsd: Record<string, number>;
}

export interface IntentSimConfig {
  seed: number;
  /** Default market averages (USD). */
  averages: MarketAverages;
  /** Log-vol of mid noise per step (e.g. 0.01 = ~1%). */
  midNoiseSigma: number;
  minNotionalUsd: number;
  maxNotionalUsd: number;
  minDeadlineMs: number;
  pairs?: [string, string][];
}

export interface SimulatedIntent {
  request: QuoteRequestEvent;
  /** Mids used for this tick (after noise). */
  midsUsd: Record<string, number>;
  notionalUsd: number;
  pair: [string, string];
  side: 'exact_in' | 'exact_out';
}

const DEFAULT_PAIRS: [string, string][] = [
  [USDC_NEAR, WNEAR],
  [USDT_NEAR, WNEAR],
  [USDC_NEAR, USDT_NEAR],
];

/** Mulberry32 — small deterministic PRNG. */
export function createPrng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMuller(rand: () => number): number {
  const u = Math.max(1e-12, rand());
  const v = Math.max(1e-12, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pick<T>(rand: () => number, xs: T[]): T {
  return xs[Math.floor(rand() * xs.length)]!;
}

function logUniform(rand: () => number, lo: number, hi: number): number {
  const a = Math.log(lo);
  const b = Math.log(hi);
  return Math.exp(a + rand() * (b - a));
}

function decimalsOf(asset: string): bigint {
  const info = MAINNET_REGISTRY.get(asset);
  if (!info) throw new Error(`intentSim: asset not in registry ${asset}`);
  return info.decimals;
}

function usdToRaw(usd: number, asset: string, midUsd: number): bigint {
  if (!(midUsd > 0) || !(usd > 0)) throw new Error('intentSim: non-positive usd/mid');
  const units = usd / midUsd;
  const dec = Number(decimalsOf(asset));
  const raw = Math.floor(units * 10 ** dec);
  return BigInt(Math.max(1, raw));
}

export const DEFAULT_AVERAGES: MarketAverages = {
  midsUsd: {
    [USDC_NEAR]: 1.0,
    [USDT_NEAR]: 1.0,
    [WNEAR]: 1.86, // align order-of-magnitude with oracle:verify; override in config
  },
};

export function createIntentSimulator(config: IntentSimConfig) {
  const rand = createPrng(config.seed);
  const pairs = config.pairs ?? DEFAULT_PAIRS;

  function noisyMids(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [asset, mid] of Object.entries(config.averages.midsUsd)) {
      const z = boxMuller(rand);
      const m = mid * Math.exp(config.midNoiseSigma * z);
      out[asset] = Math.max(1e-12, m);
    }
    return out;
  }

  function next(quoteId?: string): SimulatedIntent {
    const midsUsd = noisyMids();
    const pair = pick(rand, pairs);
    const [a, b] = pair;
    // random direction
    const flip = rand() < 0.5;
    const assetIn = flip ? a : b;
    const assetOut = flip ? b : a;
    const notionalUsd = logUniform(rand, config.minNotionalUsd, config.maxNotionalUsd);
    const side: 'exact_in' | 'exact_out' = rand() < 0.5 ? 'exact_in' : 'exact_out';

    const midIn = midsUsd[assetIn];
    const midOut = midsUsd[assetOut];
    if (midIn === undefined || midOut === undefined) {
      throw new Error('intentSim: missing mid for pair leg');
    }

    const id =
      quoteId ??
      `0xsim${Math.floor(rand() * 1e16).toString(16).padStart(14, '0')}`;

    let exactAmountIn: bigint | undefined;
    let exactAmountOut: bigint | undefined;
    if (side === 'exact_in') {
      exactAmountIn = usdToRaw(notionalUsd, assetIn, midIn);
    } else {
      exactAmountOut = usdToRaw(notionalUsd, assetOut, midOut);
    }

    const request: QuoteRequestEvent = {
      quoteId: id,
      assetIn,
      assetOut,
      exactAmountIn,
      exactAmountOut,
      minDeadlineMs: config.minDeadlineMs,
    };

    return { request, midsUsd, notionalUsd, pair: [assetIn, assetOut], side };
  }

  function nextBatch(n: number): SimulatedIntent[] {
    const out: SimulatedIntent[] = [];
    for (let i = 0; i < n; i++) out.push(next());
    return out;
  }

  return { next, nextBatch, config };
}

export type IntentSimulator = ReturnType<typeof createIntentSimulator>;
