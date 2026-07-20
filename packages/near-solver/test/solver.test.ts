import { describe, it, expect, beforeEach } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { SolverPipeline, LedgerInventory } from '../src/solver';
import { SolverRiskGuard } from '../src/risk';
import type { QuoteRequestEvent } from '../src/codec';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

/** mid: 2 wNEAR per USDC; USDC = $1, wNEAR = $0.50 */
const priceSource = {
  mid(assetIn: string, assetOut: string): FloatLib.FloatFixed | null {
    if (assetIn === USDC && assetOut === WNEAR) return FloatLib.toFloat(2n, 0n);
    if (assetIn === WNEAR && assetOut === USDC) return FloatLib.toFloat(5n, 1n);
    return null;
  },
  usdPrice(asset: string): FloatLib.FloatFixed | null {
    if (asset === USDC) return FloatLib.ONE;
    if (asset === WNEAR) return FloatLib.toFloat(5n, 1n);
    return null;
  },
};

const deadPriceSource = { mid: () => null, usdPrice: () => null };

function quoteEvent(overrides: Partial<QuoteRequestEvent> = {}): QuoteRequestEvent {
  return {
    quoteId: 'q-1',
    assetIn: USDC,
    assetOut: WNEAR,
    exactAmountIn: 100_000000n, // 100 USDC
    minDeadlineMs: 60_000,
    ...overrides,
  };
}

function makePipeline(opts: {
  inventoryWnear?: bigint;
  inventoryUsdc?: bigint;
  priceSrc?: typeof priceSource;
  guard?: SolverRiskGuard;
} = {}) {
  const inventory = {
    balances: new Map<string, bigint>([
      [WNEAR, opts.inventoryWnear ?? 1_000n * 10n ** 24n],
      [USDC, opts.inventoryUsdc ?? 10_000_000000n],
    ]),
    availableRaw(asset: string): bigint {
      return this.balances.get(asset) ?? 0n;
    },
  };
  const guard =
    opts.guard ??
    new SolverRiskGuard({
      maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
      maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
    });
  return new SolverPipeline({
    registry: REGISTRY,
    priceSource: opts.priceSrc ?? priceSource,
    inventory,
    riskGuard: guard,
    config: {
      signerId: 'sentinel-solver.near',
      halfSpreadBps: 50,
      maxInventorySkewBps: 100,
      quoteValidityMs: 60_000,
      minNotionalUsd: FloatLib.toFloat(10n, 0n),
    },
    now: () => Date.parse('2026-07-20T12:00:00.000Z'),
  });
}

describe('SolverPipeline.decide', () => {
  it('quotes a listed pair with priced spread', () => {
    const d = makePipeline().decide(quoteEvent());
    expect(d.shouldQuote).toBe(true);
    if (!d.shouldQuote) throw new Error('unreachable');
    // 100 USDC * 2 = 200 wNEAR, minus 50bps half-spread + small skew; must be < 200, > 190
    expect(d.amountInRaw).toBe(100_000000n);
    expect(d.amountOutRaw).toBeLessThan(200n * 10n ** 24n);
    expect(d.amountOutRaw).toBeGreaterThan(190n * 10n ** 24n);
    expect(d.deadlineIso).toBe('2026-07-20T12:01:00.000Z');
  });

  it('rejects unlisted assets', () => {
    const d = makePipeline().decide(quoteEvent({ assetIn: 'nep141:shitcoin.near' }));
    expect(d.shouldQuote).toBe(false);
    if (d.shouldQuote) throw new Error('unreachable');
    expect(d.reason).toBe('asset_not_listed');
  });

  it('fail-closed when price source has no price', () => {
    const d = makePipeline({ priceSrc: deadPriceSource }).decide(quoteEvent());
    expect(d.shouldQuote).toBe(false);
    if (d.shouldQuote) throw new Error('unreachable');
    expect(d.reason).toBe('no_price');
  });

  it('rejects when payout exceeds inventory', () => {
    const d = makePipeline({ inventoryWnear: 10n * 10n ** 24n }).decide(quoteEvent());
    expect(d.shouldQuote).toBe(false);
    if (d.shouldQuote) throw new Error('unreachable');
    expect(d.reason).toBe('insufficient_inventory');
  });

  it('widens spread as inventory utilization rises (skew)', () => {
    const rich = makePipeline({ inventoryWnear: 100_000n * 10n ** 24n }).decide(quoteEvent());
    const tight = makePipeline({ inventoryWnear: 210n * 10n ** 24n }).decide(quoteEvent());
    if (!rich.shouldQuote || !tight.shouldQuote) throw new Error('both should quote');
    expect(tight.amountOutRaw).toBeLessThan(rich.amountOutRaw); // tighter inventory -> worse price for taker
  });

  it('rejects dust below min notional', () => {
    const d = makePipeline().decide(quoteEvent({ exactAmountIn: 1_000000n })); // $1
    expect(d.shouldQuote).toBe(false);
    if (d.shouldQuote) throw new Error('unreachable');
    expect(d.reason).toBe('below_min_notional');
  });

  it('respects the risk guard verdict', () => {
    const guard = new SolverRiskGuard({
      maxQuoteNotionalUsd: FloatLib.toFloat(50n, 0n), // $50 cap
      maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
    });
    const d = makePipeline({ guard }).decide(quoteEvent()); // $100 notional
    expect(d.shouldQuote).toBe(false);
    if (d.shouldQuote) throw new Error('unreachable');
    expect(d.reason).toBe('notional_exceeds_max');
  });

  it('handles exact_amount_out requests (we ceil the input)', () => {
    const d = makePipeline().decide(
      quoteEvent({
        exactAmountIn: undefined,
        exactAmountOut: 200n * 10n ** 24n, // wants 200 wNEAR
      })
    );
    expect(d.shouldQuote).toBe(true);
    if (!d.shouldQuote) throw new Error('unreachable');
    expect(d.amountOutRaw).toBe(200n * 10n ** 24n);
    expect(d.amountInRaw).toBeGreaterThan(100_000000n); // spread charged on top
  });
});

describe('LedgerInventory (CavalRe ledger-backed)', () => {
  let inv: LedgerInventory;

  beforeEach(() => {
    inv = new LedgerInventory(REGISTRY);
    inv.deposit(USDC, 1_000_000000n, 'genesis');
    inv.deposit(WNEAR, 500n * 10n ** 24n, 'genesis');
  });

  it('reports available raw balances', () => {
    expect(inv.availableRaw(USDC)).toBe(1_000_000000n);
    expect(inv.availableRaw(WNEAR)).toBe(500n * 10n ** 24n);
    expect(inv.availableRaw('nep141:unknown.near')).toBe(0n);
  });

  it('applies a fill double-entry: in increases, out decreases', () => {
    inv.applyFill({
      assetIn: USDC,
      amountInRaw: 100_000000n,
      assetOut: WNEAR,
      amountOutRaw: 199n * 10n ** 24n,
      txHash: '0xfill1',
    });
    expect(inv.availableRaw(USDC)).toBe(1_100_000000n);
    expect(inv.availableRaw(WNEAR)).toBe(301n * 10n ** 24n);
  });

  it('halts (throws) on overdraw instead of going negative', () => {
    expect(() =>
      inv.applyFill({
        assetIn: USDC,
        amountInRaw: 1n,
        assetOut: WNEAR,
        amountOutRaw: 501n * 10n ** 24n,
        txHash: '0xbad',
      })
    ).toThrow();
  });
});
