/**
 * CROSS-CHECK FINDING X1 (critical): composed behavior of two individually
 * correct designs was wrong — settled fills change chain balances, nothing
 * applied them to the ledger, so the reconciler would kill-switch the solver
 * on its FIRST SUCCESSFUL TRADE in live mode.
 *
 * Fix: SolverRunner registers every quote in a PendingQuoteBook. During
 * reconcile, drift that EXACTLY matches a pending quote's amounts is inferred
 * as that fill: applied to the ledger, reservation released, no halt.
 * Anything that doesn't match exactly still halts. Conservative by design:
 * we never invent explanations for money.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { Reconciler, PendingQuoteBook } from '../src/reconciler';
import { LedgerInventory, ReservingInventory } from '../src/solver';
import { SolverRiskGuard } from '../src/risk';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

const usdPrice = (asset: string): FloatLib.FloatFixed | null => {
  if (asset === USDC) return FloatLib.ONE;
  if (asset === WNEAR) return FloatLib.toFloat(5n, 1n);
  return null;
};

const fetcherOf = (balances: Record<string, bigint>) => ({
  async fetchBalances(assets: string[]): Promise<Map<string, bigint>> {
    return new Map(assets.map((a) => [a, balances[a] ?? 0n]));
  },
});

const FILL = {
  quoteId: 'q-fill',
  assetIn: USDC,
  amountInRaw: 100_000000n,
  assetOut: WNEAR,
  amountOutRaw: 199n * 10n ** 24n,
};

describe('PendingQuoteBook', () => {
  it('registers, lists, and expires quotes past deadline + grace', () => {
    const clock = { nowMs: 1000 };
    const book = new PendingQuoteBook({ graceMs: 500, now: () => clock.nowMs });
    book.register({ ...FILL, deadlineMs: 2000 });
    expect(book.pending()).toHaveLength(1);
    clock.nowMs = 2400; // past deadline, within grace
    expect(book.pending()).toHaveLength(1);
    clock.nowMs = 2501; // past deadline + grace
    expect(book.pending()).toHaveLength(0);
  });

  it('remove() drops a matched quote', () => {
    const book = new PendingQuoteBook({ graceMs: 500, now: () => 0 });
    book.register({ ...FILL, deadlineMs: 10_000 });
    book.remove(FILL.quoteId);
    expect(book.pending()).toHaveLength(0);
  });
});

describe('Reconciler with fill inference (X1 regression)', () => {
  let clock: { nowMs: number };
  let ledger: LedgerInventory;
  let reserving: ReservingInventory;
  let guard: SolverRiskGuard;
  let book: PendingQuoteBook;
  let reconciler: Reconciler;

  beforeEach(async () => {
    clock = { nowMs: 1_000_000 };
    ledger = new LedgerInventory(REGISTRY);
    ledger.deposit(USDC, 1_000_000000n, 'genesis');
    ledger.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');
    reserving = new ReservingInventory(ledger, () => clock.nowMs);
    guard = new SolverRiskGuard({
      maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
      maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
    });
    book = new PendingQuoteBook({ graceMs: 30_000, now: () => clock.nowMs });
    reconciler = new Reconciler({
      registry: REGISTRY,
      inventory: ledger,
      riskGuard: guard,
      usdPrice,
      maxDriftUsd: FloatLib.toFloat(1n, 0n),
      pendingQuotes: book,
      reservations: reserving,
    });
    // baseline
    await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_000_000000n, [WNEAR]: 1_000n * 10n ** 24n })
    );
  });

  it('THE FIX: a settled fill is inferred and applied, NOT treated as divergence', async () => {
    // quote goes out: reserved + registered
    reserving.reserve(FILL.quoteId, WNEAR, FILL.amountOutRaw, clock.nowMs + 60_000);
    book.register({ ...FILL, deadlineMs: clock.nowMs + 60_000 });

    // taker filled us on-chain: +100 USDC, -199 wNEAR
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_100_000000n, [WNEAR]: 801n * 10n ** 24n })
    );

    expect(report.status).toBe('ok'); // NOT halted
    expect(report.inferredFills).toHaveLength(1);
    expect(report.inferredFills[0]!.quoteId).toBe('q-fill');
    expect(guard.state.killSwitch).toBeNull();
    // ledger caught up
    expect(ledger.availableRaw(USDC)).toBe(1_100_000000n);
    expect(ledger.availableRaw(WNEAR)).toBe(801n * 10n ** 24n);
    // reservation released, book entry consumed
    expect(reserving.activeReservationCount).toBe(0);
    expect(book.pending()).toHaveLength(0);
  });

  it('records the fill PnL against the baseline (fills are marks, not drift)', async () => {
    reserving.reserve(FILL.quoteId, WNEAR, FILL.amountOutRaw, clock.nowMs + 60_000);
    book.register({ ...FILL, deadlineMs: clock.nowMs + 60_000 });
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_100_000000n, [WNEAR]: 801n * 10n ** 24n })
    );
    // received $100, paid 199 * $0.50 = $99.50 -> +$0.50
    expect(report.pnlUsd).not.toBeNull();
    expect(FloatLib.toNumber(report.pnlUsd!)).toBeCloseTo(0.5, 6);
  });

  it('drift that matches NO pending quote still halts (unchanged safety)', async () => {
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_100_000000n, [WNEAR]: 801n * 10n ** 24n }) // same drift, no book entry
    );
    expect(report.status).toBe('halted');
    expect(guard.state.killSwitch).toBe('reconciliation_divergence');
  });

  it('near-miss amounts do NOT infer — exact match only, conservative', async () => {
    reserving.reserve(FILL.quoteId, WNEAR, FILL.amountOutRaw, clock.nowMs + 60_000);
    book.register({ ...FILL, deadlineMs: clock.nowMs + 60_000 });
    // chain shows one raw unit less USDC than the quote said
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_099_999999n, [WNEAR]: 801n * 10n ** 24n })
    );
    expect(report.status).toBe('halted');
    expect(report.inferredFills).toHaveLength(0);
  });

  it('handles two settled fills in one reconcile cycle', async () => {
    const FILL2 = {
      quoteId: 'q-fill-2',
      assetIn: USDC,
      amountInRaw: 50_000000n,
      assetOut: WNEAR,
      amountOutRaw: 99n * 10n ** 24n,
    };
    for (const f of [FILL, FILL2]) {
      reserving.reserve(f.quoteId, WNEAR, f.amountOutRaw, clock.nowMs + 60_000);
      book.register({ ...f, deadlineMs: clock.nowMs + 60_000 });
    }
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_150_000000n, [WNEAR]: 702n * 10n ** 24n })
    );
    expect(report.status).toBe('ok');
    expect(report.inferredFills).toHaveLength(2);
    expect(ledger.availableRaw(WNEAR)).toBe(702n * 10n ** 24n);
  });
});
