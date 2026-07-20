/**
 * 1Click token-price source — VERIFIED against the live API on 2026-07-20
 * (fixture recorded verbatim; G1 exit criterion "recorded live fixture").
 *
 * Real-world findings driving this design:
 *  X12: Pyth Core drops NEAR support 2026-08-18, so this endpoint is a
 *       PRIMARY median leg, not just a sanity check.
 *  - The API returns ALL tokens in one call: the adapter memoizes the list
 *    per refresh window so a PriceCache cycle costs one HTTP request, not N.
 *  - price: 0 entries exist in the wild (see fixture) and must be rejected —
 *    zero is a sentinel for "no price", not a price.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { readFileSync } from 'node:fs';
import { OneClickPriceSource } from '../src/oneClick';

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/oneclick-tokens.json', import.meta.url), 'utf8')
);

const WNEAR = 'nep141:wrap.near';
const USDC = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const RECORDED_AT_MS = Date.parse('2026-07-20T08:05:00.533Z');

function make(opts: { tokens?: unknown; failNext?: { fail: boolean }; nowMs?: number } = {}) {
  let calls = 0;
  const source = new OneClickPriceSource({
    fetchFn: (async () => {
      calls++;
      if (opts.failNext?.fail) throw new Error('network down');
      return { ok: true, json: async () => opts.tokens ?? FIXTURE.tokens };
    }) as never,
    listTtlMs: 2_000,
    now: () => opts.nowMs ?? RECORDED_AT_MS + 1000,
  });
  return { source, callCount: () => calls };
}

describe('OneClickPriceSource (fixture recorded from live API)', () => {
  it('serves USD prices with the API-reported timestamp', async () => {
    const { source } = make();
    const p = await source.fetchUsdPrice(WNEAR);
    expect(p).not.toBeNull();
    expect(FloatLib.toNumber(p!.price)).toBeCloseTo(1.93, 10);
    expect(p!.asOfMs).toBe(RECORDED_AT_MS);
  });

  it('derives mid from two USD legs (wNEAR per USDC ≈ 0.518)', async () => {
    const { source } = make();
    const mid = await source.fetchMid(USDC, WNEAR);
    expect(mid).not.toBeNull();
    expect(FloatLib.toNumber(mid!.price)).toBeCloseTo(0.999779 / 1.93, 8);
  });

  it('one PriceCache refresh cycle = one HTTP request (memoized list)', async () => {
    const { source, callCount } = make();
    await source.fetchUsdPrice(WNEAR);
    await source.fetchUsdPrice(USDC);
    await source.fetchMid(USDC, WNEAR);
    expect(callCount()).toBe(1);
  });

  it('rejects price: 0 entries — zero is a sentinel, not a price', async () => {
    const { source } = make();
    expect(await source.fetchUsdPrice('nep141:zero-price.near')).toBeNull();
  });

  it('returns null for unknown assets and on network failure (fail-closed)', async () => {
    const failNext = { fail: false };
    const { source } = make({ failNext });
    expect(await source.fetchUsdPrice('nep141:not-listed.near')).toBeNull();
    failNext.fail = true;
    const fresh = make({ failNext });
    expect(await fresh.source.fetchUsdPrice(WNEAR)).toBeNull();
  });

  it('rejects malformed API responses without throwing', async () => {
    const { source } = make({ tokens: { unexpected: 'shape' } });
    expect(await source.fetchUsdPrice(WNEAR)).toBeNull();
  });
});
