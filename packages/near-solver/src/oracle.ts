/**
 * ORACLE LAYER
 *
 * Three cooperating pieces, each closing a cross-reference finding:
 *
 *  PythPriceSource   — async adapter for the Pyth contract on NEAR.
 *                      X6: publish_time arrives in SECONDS and is converted
 *                      to asOfMs here, in exactly one place.
 *                      Quant: wide confidence intervals (conf/price above
 *                      maxConfBps) are rejected — publisher disagreement is
 *                      not a price.
 *  MedianPriceSource — no single source ever drives quotes. Median across
 *                      providers; refuses to price when sources disagree
 *                      beyond maxDeviationBps or fewer than minSources
 *                      respond (an outage must not silently become
 *                      single-source pricing).
 *  PriceCache        — X8: bridges async fetchers to the pipeline's sync
 *                      PriceSource reads. Serves last-known values with
 *                      their ORIGINAL timestamps; StalenessGuardedPriceSource
 *                      ages them out. Failed refreshes keep old values.
 *
 * NOTE (G1 exit criterion): Pyth feed identifiers and the deployed contract
 * account must be verified against https://docs.pyth.network before live
 * dry-run. The adapter validates structure, not feed-id correctness.
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import type { ViewCaller } from './nearRpc';
import type { TimestampedPrice, TimestampedPriceSource } from './staleness';
import { bpsToFraction } from './pricing';

const DEFAULT_PYTH_CONTRACT = 'pyth.near';
const MS_PER_SECOND = 1000;
const MAX_ABS_EXPO = 30;

// ============================================================================
// PYTH ADAPTER (async)
// ============================================================================

export interface AsyncPriceFetcher {
  fetchUsdPrice(asset: string): Promise<TimestampedPrice | null>;
  fetchMid(assetIn: string, assetOut: string): Promise<TimestampedPrice | null>;
}

export interface PythPriceSourceOptions {
  rpc: ViewCaller;
  /** defuse asset id -> Pyth price feed identifier. */
  feedIds: Map<string, string>;
  /** Reject when conf/price exceeds this (publisher disagreement). */
  maxConfBps: number;
  contractId?: string;
}

export class PythPriceSource implements AsyncPriceFetcher {
  private readonly contractId: string;

  constructor(private readonly opts: PythPriceSourceOptions) {
    this.contractId = opts.contractId ?? DEFAULT_PYTH_CONTRACT;
  }

  async fetchUsdPrice(asset: string): Promise<TimestampedPrice | null> {
    const feedId = this.opts.feedIds.get(asset);
    if (!feedId) return null;

    let raw: unknown;
    try {
      raw = await this.opts.rpc.callView(this.contractId, 'get_price', {
        price_identifier: feedId,
      });
    } catch {
      return null; // RPC failure: no price, pipeline fail-closes
    }
    return this.parsePythPrice(raw);
  }

  async fetchMid(assetIn: string, assetOut: string): Promise<TimestampedPrice | null> {
    const [usdIn, usdOut] = await Promise.all([
      this.fetchUsdPrice(assetIn),
      this.fetchUsdPrice(assetOut),
    ]);
    if (usdIn === null || usdOut === null) return null;
    if (FloatLib.isZero(usdOut.price)) return null;
    return {
      price: FloatLib.divide(usdIn.price, usdOut.price),
      // Conservative: a mid is only as fresh as its OLDER leg.
      asOfMs: Math.min(usdIn.asOfMs, usdOut.asOfMs),
    };
  }

  private parsePythPrice(raw: unknown): TimestampedPrice | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;

    let price: bigint;
    let conf: bigint;
    try {
      price = BigInt(String(p['price']));
      conf = BigInt(String(p['conf']));
    } catch {
      return null;
    }
    const expo = p['expo'];
    const publishTime = p['publish_time'];

    if (price <= 0n || conf < 0n) return null;
    if (typeof expo !== 'number' || !Number.isInteger(expo) || Math.abs(expo) > MAX_ABS_EXPO) {
      return null;
    }
    if (typeof publishTime !== 'number' || !Number.isInteger(publishTime) || publishTime <= 0) {
      return null;
    }
    // Quant guard: conf/price > maxConfBps/10_000 -> publishers disagree.
    if (conf * 10_000n > price * BigInt(this.opts.maxConfBps)) return null;

    return {
      price: FloatLib.normalize(price, BigInt(expo)),
      asOfMs: publishTime * MS_PER_SECOND, // X6: seconds -> ms, only here
    };
  }
}

// ============================================================================
// MEDIAN AGGREGATOR (sync, over cached sources)
// ============================================================================

export interface MedianPriceSourceOptions {
  sources: TimestampedPriceSource[];
  /** Max (max-min)/median spread across sources before refusing to price. */
  maxDeviationBps: number;
  /** Minimum responding sources; below this, no price. */
  minSources: number;
}

export class MedianPriceSource implements TimestampedPriceSource {
  constructor(private readonly opts: MedianPriceSourceOptions) {}

  usdPrice(asset: string): TimestampedPrice | null {
    return this.aggregate(this.opts.sources.map((s) => s.usdPrice(asset)));
  }

  mid(assetIn: string, assetOut: string): TimestampedPrice | null {
    return this.aggregate(this.opts.sources.map((s) => s.mid(assetIn, assetOut)));
  }

  private aggregate(candidates: (TimestampedPrice | null)[]): TimestampedPrice | null {
    const live = candidates.filter((c): c is TimestampedPrice => c !== null);
    if (live.length < this.opts.minSources) return null;

    const sorted = [...live].sort((a, b) =>
      FloatLib.isLT(a.price, b.price) ? -1 : FloatLib.isEQ(a.price, b.price) ? 0 : 1
    );

    const n = sorted.length;
    const median =
      n % 2 === 1
        ? sorted[(n - 1) / 2]!.price
        : FloatLib.divide(
            FloatLib.plus(sorted[n / 2 - 1]!.price, sorted[n / 2]!.price),
            FloatLib.toFloat(2n, 0n)
          );
    if (FloatLib.isZero(median)) return null;

    const spread = FloatLib.divide(
      FloatLib.minus(sorted[n - 1]!.price, sorted[0]!.price),
      median
    );
    if (FloatLib.isGT(spread, bpsToFraction(this.opts.maxDeviationBps))) return null;

    return {
      price: median,
      asOfMs: Math.min(...live.map((c) => c.asOfMs)), // only as fresh as the oldest input
    };
  }
}

// ============================================================================
// PRICE CACHE (X8: async fetcher -> sync PriceSource bridge)
// ============================================================================

export interface PriceCacheUniverse {
  assets: string[];
  pairs: [string, string][];
}

export class PriceCache implements TimestampedPriceSource {
  private readonly usd = new Map<string, TimestampedPrice>();
  private readonly mids = new Map<string, TimestampedPrice>();

  constructor(
    private readonly fetcher: AsyncPriceFetcher,
    private readonly universe: PriceCacheUniverse
  ) {}

  /** Poll all configured assets/pairs. Failures keep the previous values. */
  async refresh(): Promise<void> {
    for (const asset of this.universe.assets) {
      try {
        const p = await this.fetcher.fetchUsdPrice(asset);
        if (p !== null) this.usd.set(asset, p);
      } catch {
        // keep last-known; staleness guard is the backstop
      }
    }
    for (const [a, b] of this.universe.pairs) {
      try {
        const p = await this.fetcher.fetchMid(a, b);
        if (p !== null) this.mids.set(`${a}|${b}`, p);
      } catch {
        // keep last-known
      }
    }
  }

  usdPrice(asset: string): TimestampedPrice | null {
    return this.usd.get(asset) ?? null;
  }

  mid(assetIn: string, assetOut: string): TimestampedPrice | null {
    return this.mids.get(`${assetIn}|${assetOut}`) ?? null;
  }
}
