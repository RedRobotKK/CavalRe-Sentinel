/**
 * QUANT REVIEW: a stale price is worse than no price — you will be picked
 * off by everyone who has the fresh one. Any real oracle adapter must sit
 * behind this wrapper: prices older than maxAgeMs become null, and the
 * pipeline's existing no_price fail-closed path takes over.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { StalenessGuardedPriceSource } from '../src/staleness';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

describe('StalenessGuardedPriceSource', () => {
  function make(asOfMs: number, nowMs: number, maxAgeMs = 5_000) {
    const inner = {
      mid: () => ({ price: FloatLib.toFloat(2n, 0n), asOfMs }),
      usdPrice: () => ({ price: FloatLib.ONE, asOfMs }),
    };
    return new StalenessGuardedPriceSource(inner, { maxAgeMs, now: () => nowMs });
  }

  it('passes fresh prices through unchanged', () => {
    const src = make(10_000, 12_000); // 2s old, 5s allowed
    expect(FloatLib.toNumber(src.mid(USDC, WNEAR)!)).toBe(2);
    expect(FloatLib.toNumber(src.usdPrice(USDC)!)).toBe(1);
  });

  it('returns null for stale mid prices', () => {
    const src = make(10_000, 16_000); // 6s old
    expect(src.mid(USDC, WNEAR)).toBeNull();
  });

  it('returns null for stale usd prices', () => {
    const src = make(10_000, 16_000);
    expect(src.usdPrice(USDC)).toBeNull();
  });

  it('boundary: exactly maxAgeMs old is still fresh; one ms more is stale', () => {
    expect(make(10_000, 15_000).mid(USDC, WNEAR)).not.toBeNull();
    expect(make(10_000, 15_001).mid(USDC, WNEAR)).toBeNull();
  });

  it('propagates inner null (no price at all)', () => {
    const src = new StalenessGuardedPriceSource(
      { mid: () => null, usdPrice: () => null },
      { maxAgeMs: 5_000, now: () => 0 }
    );
    expect(src.mid(USDC, WNEAR)).toBeNull();
    expect(src.usdPrice(USDC)).toBeNull();
  });

  it('rejects prices from the future (clock skew is a fault, not a bonus)', () => {
    const src = make(20_000, 10_000); // asOf 10s in the future
    expect(src.mid(USDC, WNEAR)).toBeNull();
  });
});
