/**
 * Oracle layer. Findings encoded:
 *  X6 (cross-ref): Pyth publish_time is UNIX SECONDS; TimestampedPrice.asOfMs
 *     is MILLISECONDS. The adapter must convert or every price looks 50+
 *     years stale — encoded here so it can never regress silently.
 *  Quant: a wide Pyth confidence interval means the publishers disagree —
 *     reject when conf/price exceeds maxConfBps.
 *  Quant + security: no single source drives quotes. MedianPriceSource takes
 *     the median across providers and refuses to price when sources disagree
 *     beyond maxDeviationBps (manipulation/outage defense).
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { PythPriceSource } from '../src/oracle';
import { MedianPriceSource } from '../src/oracle';
import type { TimestampedPriceSource, TimestampedPrice } from '../src/staleness';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

const PUBLISH_TIME_S = 1_753_000_000; // seconds, as Pyth reports it

function pythStub(prices: Record<string, unknown>) {
  return {
    async callView(_c: string, _m: string, args: { price_identifier: string }): Promise<unknown> {
      return prices[args.price_identifier] ?? null;
    },
  };
}

const FEEDS = new Map([
  [USDC, 'feed-usdc'],
  [WNEAR, 'feed-near'],
]);

function makePyth(prices: Record<string, unknown>, maxConfBps = 50) {
  return new PythPriceSource({
    rpc: pythStub(prices),
    feedIds: FEEDS,
    maxConfBps,
  });
}

const GOOD_FEEDS = {
  'feed-usdc': { price: '100000000', conf: '10000', expo: -8, publish_time: PUBLISH_TIME_S }, // $1.00
  'feed-near': { price: '250000000', conf: '20000', expo: -8, publish_time: PUBLISH_TIME_S }, // $2.50
};

describe('PythPriceSource', () => {
  it('scales price by expo and converts publish_time seconds -> asOfMs (X6)', async () => {
    const src = makePyth(GOOD_FEEDS);
    const p = await src.fetchUsdPrice(WNEAR);
    expect(p).not.toBeNull();
    expect(FloatLib.toNumber(p!.price)).toBeCloseTo(2.5, 10);
    expect(p!.asOfMs).toBe(PUBLISH_TIME_S * 1000); // ms, not seconds
  });

  it('quant guard: rejects prices with wide confidence intervals', async () => {
    const src = makePyth({
      'feed-near': { price: '250000000', conf: '5000000', expo: -8, publish_time: PUBLISH_TIME_S }, // conf 2%
    });
    expect(await src.fetchUsdPrice(WNEAR)).toBeNull();
  });

  it('returns null for unknown assets and missing feeds (fail-closed)', async () => {
    const src = makePyth({});
    expect(await src.fetchUsdPrice('nep141:unknown.near')).toBeNull();
    expect(await src.fetchUsdPrice(USDC)).toBeNull(); // feed id known, no data
  });

  it('rejects non-positive prices and absurd exponents', async () => {
    const bad1 = makePyth({ 'feed-usdc': { price: '-5', conf: '1', expo: -8, publish_time: PUBLISH_TIME_S } });
    expect(await bad1.fetchUsdPrice(USDC)).toBeNull();
    const bad2 = makePyth({ 'feed-usdc': { price: '1', conf: '0', expo: -99, publish_time: PUBLISH_TIME_S } });
    expect(await bad2.fetchUsdPrice(USDC)).toBeNull();
  });

  it('derives mid(a,b) as usd(a)/usd(b) with the OLDER timestamp', async () => {
    const src = makePyth({
      'feed-usdc': { price: '100000000', conf: '1000', expo: -8, publish_time: PUBLISH_TIME_S },
      'feed-near': { price: '250000000', conf: '1000', expo: -8, publish_time: PUBLISH_TIME_S - 10 },
    });
    const mid = await src.fetchMid(USDC, WNEAR); // $1 / $2.50 = 0.4 wNEAR per USDC
    expect(mid).not.toBeNull();
    expect(FloatLib.toNumber(mid!.price)).toBeCloseTo(0.4, 10);
    expect(mid!.asOfMs).toBe((PUBLISH_TIME_S - 10) * 1000); // conservative: older leg
  });
});

describe('MedianPriceSource', () => {
  const t = (v: number, asOfMs = 1000): TimestampedPrice => ({
    price: FloatLib.normalize(BigInt(Math.round(v * 1_000_000)), -6n),
    asOfMs,
  });

  function srcOf(usd: TimestampedPrice | null): TimestampedPriceSource {
    return { mid: () => null, usdPrice: () => usd };
  }

  function makeMedian(sources: TimestampedPriceSource[], maxDeviationBps = 100, minSources = 2) {
    return new MedianPriceSource({ sources, maxDeviationBps, minSources });
  }

  it('returns the median of three agreeing sources with the oldest timestamp', () => {
    const m = makeMedian([srcOf(t(2.49, 900)), srcOf(t(2.5, 1000)), srcOf(t(2.51, 1100))]);
    const p = m.usdPrice(WNEAR);
    expect(p).not.toBeNull();
    expect(FloatLib.toNumber(p!.price)).toBeCloseTo(2.5, 10);
    expect(p!.asOfMs).toBe(900);
  });

  it('averages the middle pair for an even source count', () => {
    const m = makeMedian([srcOf(t(2.4)), srcOf(t(2.6))], 1000);
    expect(FloatLib.toNumber(m.usdPrice(WNEAR)!.price)).toBeCloseTo(2.5, 10);
  });

  it('refuses to price when sources disagree beyond maxDeviationBps', () => {
    // 2.4 vs 2.6 around median 2.5 is ~800bps spread; cap is 100bps
    const m = makeMedian([srcOf(t(2.4)), srcOf(t(2.5)), srcOf(t(2.6))], 100);
    expect(m.usdPrice(WNEAR)).toBeNull();
  });

  it('refuses to price below minSources (an outage must not silently become single-source)', () => {
    const m = makeMedian([srcOf(t(2.5)), srcOf(null), srcOf(null)], 100, 2);
    expect(m.usdPrice(WNEAR)).toBeNull();
  });

  it('one poisoned source cannot move the median of three', () => {
    const m = makeMedian(
      [srcOf(t(2.5)), srcOf(t(2.501)), srcOf(t(250_000))], // one source 100000x off
      10_000_000_000, // deviation guard effectively off, to isolate the median property
      2
    );
    expect(FloatLib.toNumber(m.usdPrice(WNEAR)!.price)).toBeCloseTo(2.501, 6);
  });
});
