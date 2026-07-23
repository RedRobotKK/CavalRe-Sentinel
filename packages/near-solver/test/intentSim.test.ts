/**
 * Intent simulator — pass/fail contract.
 * TDD: protocol validity, determinism, bounds, positive mids.
 */

import { describe, it, expect } from 'vitest';
import {
  createIntentSimulator,
  createPrng,
  DEFAULT_AVERAGES,
} from '../src/sim/intentSim.js';
import { MAINNET_REGISTRY, USDC_NEAR, WNEAR } from '../src/mainnetConfig.js';

const baseCfg = {
  seed: 42,
  averages: DEFAULT_AVERAGES,
  midNoiseSigma: 0.02,
  minNotionalUsd: 10,
  maxNotionalUsd: 100,
  minDeadlineMs: 60_000,
};

describe('intentSim PRNG', () => {
  it('PASS deterministic sequence for same seed', () => {
    const a = createPrng(7);
    const b = createPrng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('FAIL different seeds diverge', () => {
    const a = createPrng(1);
    const b = createPrng(2);
    expect(a()).not.toBe(b());
  });
});

describe('intentSim protocol shape', () => {
  it('PASS exactly one of exactAmountIn | exactAmountOut', () => {
    const sim = createIntentSimulator(baseCfg);
    for (const tick of sim.nextBatch(50)) {
      const r = tick.request;
      const hasIn = r.exactAmountIn !== undefined;
      const hasOut = r.exactAmountOut !== undefined;
      expect(hasIn !== hasOut).toBe(true);
    }
  });

  it('PASS amounts are positive bigints', () => {
    const sim = createIntentSimulator(baseCfg);
    for (const tick of sim.nextBatch(50)) {
      const r = tick.request;
      const amt = r.exactAmountIn ?? r.exactAmountOut!;
      expect(amt > 0n).toBe(true);
    }
  });

  it('PASS both assets listed in MAINNET_REGISTRY', () => {
    const sim = createIntentSimulator(baseCfg);
    for (const tick of sim.nextBatch(50)) {
      expect(MAINNET_REGISTRY.has(tick.request.assetIn)).toBe(true);
      expect(MAINNET_REGISTRY.has(tick.request.assetOut)).toBe(true);
      expect(tick.request.assetIn).not.toBe(tick.request.assetOut);
    }
  });

  it('PASS minDeadlineMs matches config', () => {
    const sim = createIntentSimulator(baseCfg);
    expect(sim.next().request.minDeadlineMs).toBe(60_000);
  });
});

describe('intentSim market averages + noise', () => {
  it('PASS all mids finite and positive', () => {
    const sim = createIntentSimulator(baseCfg);
    for (const tick of sim.nextBatch(30)) {
      for (const mid of Object.values(tick.midsUsd)) {
        expect(Number.isFinite(mid)).toBe(true);
        expect(mid).toBeGreaterThan(0);
      }
    }
  });

  it('PASS notional within [min, max] USD', () => {
    const sim = createIntentSimulator(baseCfg);
    for (const tick of sim.nextBatch(40)) {
      expect(tick.notionalUsd).toBeGreaterThanOrEqual(10);
      expect(tick.notionalUsd).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it('PASS same seed → identical quote ids and amounts', () => {
    const a = createIntentSimulator(baseCfg).nextBatch(5);
    const b = createIntentSimulator(baseCfg).nextBatch(5);
    expect(a.map((t) => t.request.quoteId)).toEqual(b.map((t) => t.request.quoteId));
    expect(a.map((t) => String(t.request.exactAmountIn ?? t.request.exactAmountOut))).toEqual(
      b.map((t) => String(t.request.exactAmountIn ?? t.request.exactAmountOut))
    );
  });

  it('PASS zero noise keeps mids at averages (order of magnitude)', () => {
    const sim = createIntentSimulator({ ...baseCfg, midNoiseSigma: 0, seed: 99 });
    const tick = sim.next();
    expect(tick.midsUsd[USDC_NEAR]).toBeCloseTo(1.0, 12);
    expect(tick.midsUsd[WNEAR]).toBeCloseTo(1.86, 12);
  });
});

describe('intentSim FAIL paths / guards', () => {
  it('FAIL construction does not allow empty registry pairs only — custom bad pair throws on next', () => {
    const sim = createIntentSimulator({
      ...baseCfg,
      pairs: [['nep141:not-listed.near', WNEAR]],
    });
    expect(() => sim.next()).toThrow(/not in registry/);
  });
});
