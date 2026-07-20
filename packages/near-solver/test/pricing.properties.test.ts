/**
 * QA CROSS-CHECK X3: pointwise tests can miss whole regions. These are
 * property-style invariants over randomized (seeded, reproducible) inputs:
 *
 *  P1  Solver never loses to rounding: exact-in payout <= ideal; exact-out
 *      charge >= ideal (checked against spread-0 pricing).
 *  P2  Spread is monotone: more spread never pays takers more (exact-in)
 *      and never charges them less (exact-out).
 *  P3  Payout is monotone in size: more in never yields less out.
 *  P4  Round-trip safety: selling the exact-in payout back at the same mid
 *      never yields more than the original amount (no free loop).
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { priceExactIn, priceExactOut } from '../src/pricing';

/** Deterministic LCG so failures are reproducible from the seed. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const CASES = 250;
const rnd = lcg(20260720);

function randomCase() {
  const decimalsIn = [6n, 8n, 18n, 24n][Math.floor(rnd() * 4)]!;
  const decimalsOut = [6n, 8n, 18n, 24n][Math.floor(rnd() * 4)]!;
  // amounts from dust to whale, in whole tokens scaled to raw
  const whole = BigInt(1 + Math.floor(rnd() * 1_000_000));
  const amountInRaw = whole * 10n ** decimalsIn;
  // mid in (0.0001 .. 10000), two significant figures
  const midMantissa = BigInt(1 + Math.floor(rnd() * 99));
  const midShift = BigInt(Math.floor(rnd() * 9) - 4); // 10^-4 .. 10^4
  const mid = FloatLib.normalize(midMantissa, midShift);
  const spreadBps = Math.floor(rnd() * 200); // 0..199 bps
  return { decimalsIn, decimalsOut, amountInRaw, mid, spreadBps };
}

describe(`pricing properties over ${CASES} randomized cases (seed 20260720)`, () => {
  it('P1 + P2 (exact-in): spread-priced payout <= mid payout; monotone in spread', () => {
    for (let i = 0; i < CASES; i++) {
      const c = randomCase();
      const atMid = priceExactIn({
        amountInRaw: c.amountInRaw,
        decimalsIn: c.decimalsIn,
        decimalsOut: c.decimalsOut,
        mid: c.mid,
        totalSpreadBps: 0,
      });
      const withSpread = priceExactIn({
        amountInRaw: c.amountInRaw,
        decimalsIn: c.decimalsIn,
        decimalsOut: c.decimalsOut,
        mid: c.mid,
        totalSpreadBps: c.spreadBps,
      });
      const wider = priceExactIn({
        amountInRaw: c.amountInRaw,
        decimalsIn: c.decimalsIn,
        decimalsOut: c.decimalsOut,
        mid: c.mid,
        totalSpreadBps: c.spreadBps + 50,
      });
      expect(withSpread <= atMid, `case ${i}: spread payout exceeds mid`).toBe(true);
      expect(wider <= withSpread, `case ${i}: wider spread paid MORE`).toBe(true);
    }
  });

  it('P1 + P2 (exact-out): spread-priced charge >= mid charge; monotone in spread', () => {
    for (let i = 0; i < CASES; i++) {
      const c = randomCase();
      const amountOutRaw = c.amountInRaw; // reuse as an out-amount at decimalsIn
      const atMid = priceExactOut({
        amountOutRaw,
        decimalsIn: c.decimalsOut,
        decimalsOut: c.decimalsIn,
        mid: c.mid,
        totalSpreadBps: 0,
      });
      const withSpread = priceExactOut({
        amountOutRaw,
        decimalsIn: c.decimalsOut,
        decimalsOut: c.decimalsIn,
        mid: c.mid,
        totalSpreadBps: c.spreadBps,
      });
      const wider = priceExactOut({
        amountOutRaw,
        decimalsIn: c.decimalsOut,
        decimalsOut: c.decimalsIn,
        mid: c.mid,
        totalSpreadBps: c.spreadBps + 50,
      });
      expect(withSpread >= atMid, `case ${i}: spread charge below mid`).toBe(true);
      expect(wider >= withSpread, `case ${i}: wider spread charged LESS`).toBe(true);
    }
  });

  it('P3: payout monotone in input size', () => {
    for (let i = 0; i < CASES; i++) {
      const c = randomCase();
      const out1 = priceExactIn({
        amountInRaw: c.amountInRaw,
        decimalsIn: c.decimalsIn,
        decimalsOut: c.decimalsOut,
        mid: c.mid,
        totalSpreadBps: c.spreadBps,
      });
      const out2 = priceExactIn({
        amountInRaw: c.amountInRaw * 2n,
        decimalsIn: c.decimalsIn,
        decimalsOut: c.decimalsOut,
        mid: c.mid,
        totalSpreadBps: c.spreadBps,
      });
      expect(out2 >= out1, `case ${i}: doubling input reduced output`).toBe(true);
    }
  });

  it('P4: round trip at the same mid never creates free money', () => {
    for (let i = 0; i < CASES; i++) {
      const c = randomCase();
      const out = priceExactIn({
        amountInRaw: c.amountInRaw,
        decimalsIn: c.decimalsIn,
        decimalsOut: c.decimalsOut,
        mid: c.mid,
        totalSpreadBps: c.spreadBps,
      });
      if (out === 0n) continue; // dust annihilated by flooring: fine
      const inverseMid = FloatLib.divide(FloatLib.ONE, c.mid);
      const back = priceExactIn({
        amountInRaw: out,
        decimalsIn: c.decimalsOut,
        decimalsOut: c.decimalsIn,
        mid: inverseMid,
        totalSpreadBps: c.spreadBps,
      });
      expect(back <= c.amountInRaw, `case ${i}: round trip minted ${back - c.amountInRaw}`).toBe(true);
    }
  });
});
