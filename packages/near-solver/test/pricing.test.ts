import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { priceExactIn, priceExactOut, floorToRaw, ceilToRaw, bpsToFraction } from '../src/pricing';

const USDC_DECIMALS = 6n;
const WNEAR_DECIMALS = 24n;

/** $100 USDC in raw units */
const RAW_100_USDC = 100_000000n;

describe('raw unit conversion', () => {
  it('floorToRaw floors fractional raw units', () => {
    // 1.9 USDC -> 1900000 raw exactly; 1.9999999 -> floors within 6 decimals
    const f = FloatLib.toFloat(19n, 1n); // 1.9
    expect(floorToRaw(f, USDC_DECIMALS)).toBe(1_900000n);
    const tiny = FloatLib.divide(FloatLib.ONE, FloatLib.toFloat(3n, 0n)); // 0.333...
    expect(floorToRaw(tiny, USDC_DECIMALS)).toBe(333333n);
  });

  it('ceilToRaw ceils fractional raw units', () => {
    const tiny = FloatLib.divide(FloatLib.ONE, FloatLib.toFloat(3n, 0n)); // 0.333...
    expect(ceilToRaw(tiny, USDC_DECIMALS)).toBe(333334n);
  });

  it('floor and ceil agree on exact values', () => {
    const f = FloatLib.toFloat(5n, 0n); // 5.0
    expect(floorToRaw(f, USDC_DECIMALS)).toBe(5_000000n);
    expect(ceilToRaw(f, USDC_DECIMALS)).toBe(5_000000n);
  });
});

describe('bpsToFraction', () => {
  it('converts basis points to a fraction', () => {
    expect(FloatLib.toNumber(bpsToFraction(50))).toBeCloseTo(0.005, 10);
    expect(FloatLib.toNumber(bpsToFraction(0))).toBe(0);
  });
});

describe('priceExactIn', () => {
  const mid = FloatLib.toFloat(2n, 0n); // 2 wNEAR per USDC

  it('prices at mid with zero spread', () => {
    const out = priceExactIn({
      amountInRaw: RAW_100_USDC,
      decimalsIn: USDC_DECIMALS,
      decimalsOut: WNEAR_DECIMALS,
      mid,
      totalSpreadBps: 0,
    });
    // 100 USDC * 2 = 200 wNEAR
    expect(out).toBe(200n * 10n ** WNEAR_DECIMALS);
  });

  it('applies spread against the taker (we pay out less)', () => {
    const out = priceExactIn({
      amountInRaw: RAW_100_USDC,
      decimalsIn: USDC_DECIMALS,
      decimalsOut: WNEAR_DECIMALS,
      mid,
      totalSpreadBps: 50, // 0.5%
    });
    // 200 * 0.995 = 199 wNEAR
    expect(out).toBe(199n * 10n ** WNEAR_DECIMALS);
  });

  it('never pays out more than the un-floored ideal (conservative rounding)', () => {
    const awkwardMid = FloatLib.divide(FloatLib.ONE, FloatLib.toFloat(3n, 0n)); // 1/3
    const out = priceExactIn({
      amountInRaw: 1_000000n, // 1 USDC
      decimalsIn: USDC_DECIMALS,
      decimalsOut: USDC_DECIMALS,
      mid: awkwardMid,
      totalSpreadBps: 0,
    });
    expect(out).toBe(333333n); // floored, not 333334
  });

  it('returns 0 for zero input', () => {
    const out = priceExactIn({
      amountInRaw: 0n,
      decimalsIn: USDC_DECIMALS,
      decimalsOut: WNEAR_DECIMALS,
      mid,
      totalSpreadBps: 10,
    });
    expect(out).toBe(0n);
  });
});

describe('priceExactOut', () => {
  const mid = FloatLib.toFloat(2n, 0n); // 2 wNEAR per USDC

  it('computes required input at mid with zero spread', () => {
    const amountIn = priceExactOut({
      amountOutRaw: 200n * 10n ** WNEAR_DECIMALS,
      decimalsIn: USDC_DECIMALS,
      decimalsOut: WNEAR_DECIMALS,
      mid,
      totalSpreadBps: 0,
    });
    expect(amountIn).toBe(RAW_100_USDC);
  });

  it('charges spread on top (we require more in)', () => {
    const amountIn = priceExactOut({
      amountOutRaw: 200n * 10n ** WNEAR_DECIMALS,
      decimalsIn: USDC_DECIMALS,
      decimalsOut: WNEAR_DECIMALS,
      mid,
      totalSpreadBps: 100, // 1%
    });
    expect(amountIn).toBe(101_000000n); // 100 * 1.01
  });

  it('never charges less than the un-ceiled ideal (conservative rounding)', () => {
    const awkwardMid = FloatLib.toFloat(3n, 0n); // 3 out per in
    const amountIn = priceExactOut({
      amountOutRaw: 1_000000n, // 1 unit out, 6 decimals
      decimalsIn: USDC_DECIMALS,
      decimalsOut: USDC_DECIMALS,
      mid: awkwardMid,
      totalSpreadBps: 0,
    });
    expect(amountIn).toBe(333334n); // ceiled, not 333333
  });
});
