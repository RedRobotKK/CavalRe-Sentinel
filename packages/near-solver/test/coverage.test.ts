/**
 * Footprint coverage — every catalog case hits the expected pipeline branch.
 */

import { describe, it, expect } from 'vitest';
import { coverageCatalog, REQUIRED_TARGETS } from '../src/sim/coverage.js';
import { MapPriceSource } from '../src/sim/mapPriceSource.js';
import { SolverPipeline, LedgerInventory, ReservingInventory } from '../src/solver.js';
import { SolverRiskGuard } from '../src/risk.js';
import { MAINNET_REGISTRY, MAINNET } from '../src/mainnetConfig.js';
import { USDC_NEAR, WNEAR, USDT_NEAR } from '../src/mainnetConfig.js';
import * as FloatLib from '@cavalre/floatlib-ts';

function makePipeline(mids: Record<string, number>) {
  const g3 = MAINNET.g3Defaults;
  const base = new LedgerInventory(MAINNET_REGISTRY);
  base.deposit(USDC_NEAR, 1_000_000000n, 't');
  base.deposit(WNEAR, 500n * 10n ** 24n, 't');
  base.deposit(USDT_NEAR, 1_000_000000n, 't');
  const inv = new ReservingInventory(base, () => Date.now());
  const px = new MapPriceSource();
  px.setMids(mids);
  const risk = new SolverRiskGuard({
    maxQuoteNotionalUsd: g3.maxQuoteNotionalUsd,
    maxDailyLossUsd: g3.maxDailyLossUsd,
  });
  const pipeline = new SolverPipeline({
    registry: MAINNET_REGISTRY,
    priceSource: px,
    inventory: inv,
    riskGuard: risk,
    config: {
      signerId: 'test',
      halfSpreadBps: g3.halfSpreadBps,
      maxInventorySkewBps: g3.maxInventorySkewBps,
      quoteValidityMs: g3.quoteValidityMs,
      maxDeadlineMs: g3.maxDeadlineMs,
      minNotionalUsd: g3.minNotionalUsd,
    },
    now: () => Date.now(),
  });
  return { pipeline, px };
}

describe('footprint coverage catalog', () => {
  it('PASS catalog covers required targets exactly once each', () => {
    const targets = coverageCatalog().map((c) => c.target);
    expect(new Set(targets).size).toBe(REQUIRED_TARGETS.length);
    for (const t of REQUIRED_TARGETS) expect(targets).toContain(t);
  });

  for (const c of coverageCatalog()) {
    it(`PASS ${c.target} → ${c.expectReason ?? 'would_quote'}`, () => {
      const { pipeline, px } = makePipeline(c.midsUsd);
      px.setMids(c.midsUsd);
      const d = pipeline.decide(c.request);
      if (c.expectReason === null) {
        expect(d.shouldQuote).toBe(true);
      } else {
        expect(d.shouldQuote).toBe(false);
        if (!d.shouldQuote) expect(d.reason).toBe(c.expectReason);
      }
    });
  }

  it('PASS kill_switch branch via risk guard', () => {
    const g3 = MAINNET.g3Defaults;
    const base = new LedgerInventory(MAINNET_REGISTRY);
    base.deposit(USDC_NEAR, 1_000_000000n, 't');
    base.deposit(WNEAR, 500n * 10n ** 24n, 't');
    const inv = new ReservingInventory(base, () => Date.now());
    const px = new MapPriceSource();
    px.setMids({ [USDC_NEAR]: 1, [WNEAR]: 1.86, [USDT_NEAR]: 1 });
    const risk = new SolverRiskGuard({
      maxQuoteNotionalUsd: g3.maxQuoteNotionalUsd,
      maxDailyLossUsd: g3.maxDailyLossUsd,
    });
    risk.tripKillSwitch('coverage');
    const pipeline = new SolverPipeline({
      registry: MAINNET_REGISTRY,
      priceSource: px,
      inventory: inv,
      riskGuard: risk,
      config: {
        signerId: 'test',
        halfSpreadBps: g3.halfSpreadBps,
        maxInventorySkewBps: g3.maxInventorySkewBps,
        quoteValidityMs: g3.quoteValidityMs,
        maxDeadlineMs: g3.maxDeadlineMs,
        minNotionalUsd: g3.minNotionalUsd,
      },
      now: () => Date.now(),
    });
    const d = pipeline.decide({
      quoteId: '0xkill',
      assetIn: USDC_NEAR,
      assetOut: WNEAR,
      exactAmountIn: 50_000000n,
      minDeadlineMs: 60_000,
    });
    expect(d.shouldQuote).toBe(false);
    if (!d.shouldQuote) expect(d.reason).toMatch(/^kill_switch:/);
  });
});
