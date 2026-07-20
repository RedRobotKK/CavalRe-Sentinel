/**
 * X8 (cross-ref, dev × SRE): PythPriceSource is async (RPC); the pipeline's
 * PriceSource reads are sync. The PriceCache bridges them: refresh() polls,
 * sync reads serve the last-known value WITH ITS ORIGINAL TIMESTAMP, and the
 * StalenessGuardedPriceSource ages it out naturally. A failed refresh keeps
 * the old value — serving slightly-old beats serving nothing, and the
 * staleness guard is the backstop either way.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { PriceCache } from '../src/oracle';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

function makeFetcher(state: { usd: number | null; asOfMs: number; fail?: boolean }) {
  return {
    async fetchUsdPrice(_asset: string) {
      if (state.fail) throw new Error('rpc down');
      if (state.usd === null) return null;
      return { price: FloatLib.normalize(BigInt(Math.round(state.usd * 1e6)), -6n), asOfMs: state.asOfMs };
    },
    async fetchMid(_a: string, _b: string) {
      if (state.fail) throw new Error('rpc down');
      if (state.usd === null) return null;
      return { price: FloatLib.normalize(BigInt(Math.round(state.usd * 1e6)), -6n), asOfMs: state.asOfMs };
    },
  };
}

describe('PriceCache', () => {
  it('serves null before the first refresh (fail-closed)', () => {
    const cache = new PriceCache(makeFetcher({ usd: 2.5, asOfMs: 1000 }), {
      assets: [WNEAR],
      pairs: [[USDC, WNEAR]],
    });
    expect(cache.usdPrice(WNEAR)).toBeNull();
    expect(cache.mid(USDC, WNEAR)).toBeNull();
  });

  it('serves fetched values with their ORIGINAL timestamps after refresh', async () => {
    const state = { usd: 2.5, asOfMs: 123_000 };
    const cache = new PriceCache(makeFetcher(state), { assets: [WNEAR], pairs: [[USDC, WNEAR]] });
    await cache.refresh();
    const p = cache.usdPrice(WNEAR);
    expect(FloatLib.toNumber(p!.price)).toBeCloseTo(2.5, 10);
    expect(p!.asOfMs).toBe(123_000); // not "now" — staleness guard needs the truth
  });

  it('a failed refresh keeps the last-known value (staleness guard is the backstop)', async () => {
    const state: { usd: number | null; asOfMs: number; fail?: boolean } = { usd: 2.5, asOfMs: 1000 };
    const cache = new PriceCache(makeFetcher(state), { assets: [WNEAR], pairs: [] });
    await cache.refresh();
    state.fail = true;
    await cache.refresh(); // must not throw, must not wipe
    expect(cache.usdPrice(WNEAR)).not.toBeNull();
    expect(cache.usdPrice(WNEAR)!.asOfMs).toBe(1000); // still the OLD timestamp
  });
});
