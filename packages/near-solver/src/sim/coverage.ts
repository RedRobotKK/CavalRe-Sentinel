/**
 * FOOTPRINT COVERAGE — testing tool, not a market model.
 *
 * Cycles protocol-valid (and intentionally invalid) quote_requests so every
 * internal reject/accept branch in SolverPipeline + risk + reserve is hit.
 *
 * CANON: Tier A engineering coverage. Not economic signal.
 */

import type { QuoteRequestEvent } from '../codec.js';
import { USDC_NEAR, USDT_NEAR, WNEAR } from '../mainnetConfig.js';

export type CoverageTarget =
  | 'would_quote_exact_in'
  | 'would_quote_exact_out'
  | 'asset_not_listed'
  | 'deadline_too_long'
  | 'no_price'
  | 'below_min_notional'
  | 'insufficient_inventory'
  | 'notional_exceeds_max'
  | 'pair_usdt_wnear'
  | 'pair_usdc_usdt';

export interface CoverageCase {
  target: CoverageTarget;
  /** Expected decision.reason if reject; null if shouldQuote */
  expectReason: string | null;
  request: QuoteRequestEvent;
  /** Mids to load into MapPriceSource before decide. Empty → force no_price. */
  midsUsd: Record<string, number>;
  note: string;
}

const BASE_MIDS = {
  [USDC_NEAR]: 1.0,
  [USDT_NEAR]: 1.0,
  [WNEAR]: 1.86,
};

function id(tag: string): string {
  return `0xcov_${tag}_${Date.now().toString(36)}`;
}

/** Full catalog — one case per internal branch we care about. */
export function coverageCatalog(): CoverageCase[] {
  return [
    {
      target: 'would_quote_exact_in',
      expectReason: null,
      note: 'happy path exact_in USDC→wNEAR',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('ok_in'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountIn: 50_000000n, // $50
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'would_quote_exact_out',
      expectReason: null,
      note: 'happy path exact_out wNEAR←USDC',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('ok_out'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountOut: 10n * 10n ** 24n, // 10 wNEAR
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'pair_usdt_wnear',
      expectReason: null,
      note: 'second pair',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('usdt'),
        assetIn: USDT_NEAR,
        assetOut: WNEAR,
        exactAmountIn: 40_000000n,
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'pair_usdc_usdt',
      expectReason: null,
      note: 'stable-stable pair',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('stables'),
        assetIn: USDC_NEAR,
        assetOut: USDT_NEAR,
        exactAmountIn: 25_000000n,
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'asset_not_listed',
      expectReason: 'asset_not_listed',
      note: 'unknown defuse id',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('unlist'),
        assetIn: 'nep141:not-listed.near',
        assetOut: WNEAR,
        exactAmountIn: 10_000000n,
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'deadline_too_long',
      expectReason: 'deadline_too_long',
      note: 'minDeadlineMs > maxDeadlineMs (120s)',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('dead'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountIn: 20_000000n,
        minDeadlineMs: 600_000, // 10m > 120s cap
      },
    },
    {
      target: 'no_price',
      expectReason: 'no_price',
      note: 'empty mid map',
      midsUsd: {},
      request: {
        quoteId: id('nopx'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountIn: 20_000000n,
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'below_min_notional',
      expectReason: 'below_min_notional',
      note: 'tiny USDC notional < $10 min',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('dust'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountIn: 1_000000n, // $1
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'insufficient_inventory',
      expectReason: 'insufficient_inventory',
      note: 'exact_out larger than virtual wNEAR book',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('inv'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountOut: 10_000n * 10n ** 24n, // 10k wNEAR
        minDeadlineMs: 60_000,
      },
    },
    {
      target: 'notional_exceeds_max',
      expectReason: 'notional_exceeds_max',
      note: 'above maxQuoteNotionalUsd ($100)',
      midsUsd: { ...BASE_MIDS },
      request: {
        quoteId: id('max'),
        assetIn: USDC_NEAR,
        assetOut: WNEAR,
        exactAmountIn: 500_000000n, // $500
        minDeadlineMs: 60_000,
      },
    },
  ];
}

export function createCoverageRotator() {
  const catalog = coverageCatalog();
  let i = 0;
  return {
    next(): CoverageCase {
      const c = catalog[i % catalog.length]!;
      i += 1;
      // fresh quoteId each rotation so reserves don't collide on id
      return {
        ...c,
        request: { ...c.request, quoteId: id(c.target) },
      };
    },
    catalog,
    size: catalog.length,
  };
}

/** All targets the suite must observe at least once. */
export const REQUIRED_TARGETS: CoverageTarget[] = coverageCatalog().map((c) => c.target);
