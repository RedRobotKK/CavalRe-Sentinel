/**
 * STALENESS GUARD
 *
 * A stale price is worse than no price: quoting on it is how market makers
 * get picked off. Every real oracle adapter must publish timestamps and sit
 * behind this wrapper; anything older than maxAgeMs — or from the future
 * (clock skew is a fault, not a bonus) — becomes null, which the pipeline
 * already fail-closes on (`no_price`).
 */

import type * as FloatLib from '@cavalre/floatlib-ts';
import type { PriceSource } from './solver.js';

export interface TimestampedPrice {
  price: FloatLib.FloatFixed;
  asOfMs: number;
}

export interface TimestampedPriceSource {
  mid(assetIn: string, assetOut: string): TimestampedPrice | null;
  usdPrice(asset: string): TimestampedPrice | null;
}

export interface StalenessOptions {
  maxAgeMs: number;
  now: () => number;
}

export class StalenessGuardedPriceSource implements PriceSource {
  constructor(
    private readonly inner: TimestampedPriceSource,
    private readonly opts: StalenessOptions
  ) {}

  mid(assetIn: string, assetOut: string): FloatLib.FloatFixed | null {
    return this.guard(this.inner.mid(assetIn, assetOut));
  }

  usdPrice(asset: string): FloatLib.FloatFixed | null {
    return this.guard(this.inner.usdPrice(asset));
  }

  private guard(p: TimestampedPrice | null): FloatLib.FloatFixed | null {
    if (p === null) return null;
    const age = this.opts.now() - p.asOfMs;
    if (age < 0) return null; // future timestamp: broken clock somewhere
    if (age > this.opts.maxAgeMs) return null;
    return p.price;
  }
}
