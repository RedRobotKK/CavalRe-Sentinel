/**
 * QUANT + SRE REVIEW: the chain is the source of truth. Instead of trusting
 * bus settlement events we cannot yet match to our quotes, we reconcile our
 * ledger against actual intents.near balances on a cadence:
 *
 *  - DIVERGENCE (ledger vs chain beyond tolerance) means our state is wrong.
 *    Wrong state = HALT (kill switch), never guess. CavalRe ledger philosophy.
 *  - PnL is the change in total on-chain USD value BETWEEN reconciles —
 *    real marks, fed into the daily-loss breaker.
 *  - First reconcile only sets the baseline; it never records PnL.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { Reconciler } from '../src/reconciler';
import { LedgerInventory } from '../src/solver';
import { SolverRiskGuard } from '../src/risk';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

const usdPrice = (asset: string): FloatLib.FloatFixed | null => {
  if (asset === USDC) return FloatLib.ONE;
  if (asset === WNEAR) return FloatLib.toFloat(5n, 1n); // $0.50
  return null;
};

function fetcherOf(balances: Record<string, bigint>) {
  return {
    async fetchBalances(assets: string[]): Promise<Map<string, bigint>> {
      return new Map(assets.map((a) => [a, balances[a] ?? 0n]));
    },
  };
}

describe('Reconciler', () => {
  let inventory: LedgerInventory;
  let guard: SolverRiskGuard;
  let reconciler: Reconciler;

  beforeEach(() => {
    inventory = new LedgerInventory(REGISTRY);
    inventory.deposit(USDC, 1_000_000000n, 'genesis'); // $1,000
    inventory.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis'); // $500
    guard = new SolverRiskGuard({
      maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
      maxDailyLossUsd: FloatLib.toFloat(100n, 0n),
    });
    reconciler = new Reconciler({
      registry: REGISTRY,
      inventory,
      riskGuard: guard,
      usdPrice,
      maxDriftUsd: FloatLib.toFloat(1n, 0n), // $1 tolerance
    });
  });

  it('clean reconcile: chain matches ledger, baseline set, no PnL, no halt', async () => {
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_000_000000n, [WNEAR]: 1_000n * 10n ** 24n })
    );
    expect(report.status).toBe('ok');
    expect(report.pnlUsd).toBeNull(); // first run = baseline only
    expect(guard.state.killSwitch).toBeNull();
  });

  it('tolerates dust-level drift within maxDriftUsd', async () => {
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_000_500000n, [WNEAR]: 1_000n * 10n ** 24n }) // +$0.50 drift
    );
    expect(report.status).toBe('ok');
    expect(guard.state.killSwitch).toBeNull();
  });

  it('HALTS on divergence beyond tolerance — wrong state means stop, not guess', async () => {
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 900_000000n, [WNEAR]: 1_000n * 10n ** 24n }) // -$100 drift
    );
    expect(report.status).toBe('halted');
    expect(guard.state.killSwitch).toBe('reconciliation_divergence');
    expect(guard.checkQuote({ notionalUsd: FloatLib.ONE }).allowed).toBe(false);
  });

  it('records PnL as the value change BETWEEN reconciles and can trip the daily-loss breaker', async () => {
    // Baseline: $1,500 on-chain, matching ledger
    await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_000_000000n, [WNEAR]: 1_000n * 10n ** 24n })
    );
    // Fill happened: ledger updated to match chain (received $100 USDC, paid 404 wNEAR = $202)
    inventory.applyFill({
      assetIn: USDC,
      amountInRaw: 100_000000n,
      assetOut: WNEAR,
      amountOutRaw: 404n * 10n ** 24n,
      txHash: '0xfill',
    });
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_100_000000n, [WNEAR]: 596n * 10n ** 24n })
    );
    expect(report.status).toBe('ok');
    // value now: 1100 + 298 = 1398; baseline 1500 -> pnl -102
    expect(report.pnlUsd).not.toBeNull();
    expect(FloatLib.toNumber(report.pnlUsd!)).toBeCloseTo(-102, 6);
    // -102 breaches the $100 daily-loss cap
    expect(guard.checkQuote({ notionalUsd: FloatLib.ONE }).allowed).toBe(false);
    expect(guard.checkQuote({ notionalUsd: FloatLib.ONE }).reason).toBe('daily_loss_exceeded');
  });

  it('fail-closed on unpriceable assets: divergence still checked in raw units, PnL skipped', async () => {
    const registry = new Map(REGISTRY);
    registry.set('nep141:odd.near', { symbol: 'ODD', decimals: 6n });
    const inv = new LedgerInventory(registry);
    inv.deposit('nep141:odd.near', 5_000000n, 'genesis');
    const rec = new Reconciler({
      registry,
      inventory: inv,
      riskGuard: guard,
      usdPrice, // no price for ODD
      maxDriftUsd: FloatLib.toFloat(1n, 0n),
    });
    // raw amounts match exactly -> no divergence even though unpriceable
    const clean = await rec.reconcile(fetcherOf({ 'nep141:odd.near': 5_000000n }));
    expect(clean.status).toBe('ok');
    expect(clean.pnlUsd).toBeNull(); // cannot mark: no PnL claim
    // ANY raw mismatch on an unpriceable asset must halt (cannot size the damage)
    const drifted = await rec.reconcile(fetcherOf({ 'nep141:odd.near': 4_000000n }));
    expect(drifted.status).toBe('halted');
  });

  it('fetcher failure leaves all state untouched', async () => {
    const failing = {
      fetchBalances: async (): Promise<Map<string, bigint>> => {
        throw new Error('rpc down');
      },
    };
    await expect(reconciler.reconcile(failing)).rejects.toThrow('rpc down');
    expect(guard.state.killSwitch).toBeNull();
    // next successful reconcile is still treated as baseline (no phantom PnL)
    const report = await reconciler.reconcile(
      fetcherOf({ [USDC]: 1_000_000000n, [WNEAR]: 1_000n * 10n ** 24n })
    );
    expect(report.pnlUsd).toBeNull();
  });
});
