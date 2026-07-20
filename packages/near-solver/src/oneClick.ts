/**
 * 1CLICK TOKEN PRICE SOURCE
 *
 * AsyncPriceFetcher over the NEAR Intents 1Click API's public token list
 * (verified live 2026-07-20; fixture in test/fixtures/oneclick-tokens.json).
 *
 * Why this is a PRIMARY median leg and not a sanity check (X12): Pyth Core
 * drops NEAR support on 2026-08-18, so the oracle composition cannot lean on
 * Pyth long-term. This endpoint serves USD prices with real timestamps
 * (`priceUpdatedAt`) for exactly the assets the solver trades.
 *
 * Design notes:
 *  - One HTTP call returns ALL tokens; the list is memoized for listTtlMs so
 *    a PriceCache refresh cycle costs one request, not one per asset.
 *  - `price: 0` entries exist in the wild and are rejected: zero is the
 *    API's "no price" sentinel, never a price.
 *  - Prices arrive as JSON floats; they are converted once at ingestion to
 *    FloatLib via a 12-significant-decimal scaling. Oracle inputs are the
 *    single tolerated float boundary — everything after is FloatLib.
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import type { AsyncPriceFetcher } from './oracle';
import type { TimestampedPrice } from './staleness';

const DEFAULT_URL = 'https://1click.chaindefuser.com/v0/tokens';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_LIST_TTL_MS = 2_000;
/** JSON float -> FloatFixed via 12 decimal places (oracle precision, not money). */
const PRICE_INGEST_DECIMALS = 12;

interface FetchResponseLike {
  ok: boolean;
  json(): Promise<unknown>;
}

type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<FetchResponseLike>;

export interface OneClickPriceSourceOptions {
  url?: string;
  fetchFn?: FetchLike;
  timeoutMs?: number;
  listTtlMs?: number;
  now?: () => number;
}

interface TokenEntry {
  priceUsd: FloatLib.FloatFixed;
  asOfMs: number;
}

export class OneClickPriceSource implements AsyncPriceFetcher {
  private readonly url: string;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;
  private readonly listTtlMs: number;
  private readonly now: () => number;

  private cache: Map<string, TokenEntry> | null = null;
  private cacheAtMs = -Infinity;

  constructor(opts: OneClickPriceSourceOptions = {}) {
    this.url = opts.url ?? DEFAULT_URL;
    this.fetchFn = opts.fetchFn ?? (fetch as unknown as FetchLike);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.listTtlMs = opts.listTtlMs ?? DEFAULT_LIST_TTL_MS;
    this.now = opts.now ?? Date.now;
  }

  async fetchUsdPrice(asset: string): Promise<TimestampedPrice | null> {
    const list = await this.tokenList();
    if (list === null) return null;
    const entry = list.get(asset);
    if (!entry) return null;
    return { price: entry.priceUsd, asOfMs: entry.asOfMs };
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
      asOfMs: Math.min(usdIn.asOfMs, usdOut.asOfMs), // as fresh as the older leg
    };
  }

  private async tokenList(): Promise<Map<string, TokenEntry> | null> {
    if (this.cache !== null && this.now() - this.cacheAtMs <= this.listTtlMs) {
      return this.cache;
    }

    let raw: unknown;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(this.url, { signal: controller.signal });
      if (!response.ok) return null;
      raw = await response.json();
    } catch {
      return null; // fail-closed; PriceCache keeps last-known
    } finally {
      clearTimeout(timer);
    }

    if (!Array.isArray(raw)) return null;

    const list = new Map<string, TokenEntry>();
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue;
      const t = item as Record<string, unknown>;
      const assetId = t['assetId'];
      const price = t['price'];
      const updatedAt = t['priceUpdatedAt'];
      if (typeof assetId !== 'string' || assetId.length === 0) continue;
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue; // 0 = sentinel
      if (typeof updatedAt !== 'string') continue;
      const asOfMs = Date.parse(updatedAt);
      if (!Number.isFinite(asOfMs)) continue;

      const scaled = BigInt(Math.round(price * 10 ** PRICE_INGEST_DECIMALS));
      if (scaled <= 0n) continue;
      list.set(assetId, {
        priceUsd: FloatLib.normalize(scaled, BigInt(-PRICE_INGEST_DECIMALS)),
        asOfMs,
      });
    }

    this.cache = list;
    this.cacheAtMs = this.now();
    return list;
  }
}
