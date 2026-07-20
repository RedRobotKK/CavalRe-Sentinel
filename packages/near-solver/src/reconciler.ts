/**
 * ON-CHAIN RECONCILER
 *
 * The chain is the source of truth. On a cadence, compare actual
 * intents.near balances against what our ledger says we should hold:
 *
 *  - DIVERGENCE beyond tolerance -> kill switch. Wrong internal state means
 *    every downstream number is suspect; halt and let a human reconcile.
 *    (Same philosophy as CavalRe Ledger.checkDivergence -> halt.)
 *  - PnL = change in total on-chain USD value BETWEEN reconciles. These are
 *    real marks from real balances, fed into the risk guard's daily-loss
 *    breaker. The first reconcile only establishes the baseline.
 *  - Unpriceable assets: divergence is still enforced in raw units (any
 *    mismatch halts — we cannot size damage we cannot price), and PnL is
 *    skipped rather than fabricated.
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import { rawToFloat } from './pricing';
import type { SolverRiskGuard } from './risk';
import type { AssetRegistry, LedgerInventory } from './solver';

export interface OnChainBalanceFetcher {
  /** Actual balances held on the verifier contract, in raw token units. */
  fetchBalances(assets: string[]): Promise<Map<string, bigint>>;
}

export interface AssetDrift {
  asset: string;
  expectedRaw: bigint;
  actualRaw: bigint;
  driftRaw: bigint; // actual - expected
  driftUsd: FloatLib.FloatFixed | null; // null when unpriceable
}

export interface ReconcileReport {
  status: 'ok' | 'halted';
  drifts: AssetDrift[];
  /** Value change since previous reconcile; null on baseline or unpriceable. */
  pnlUsd: FloatLib.FloatFixed | null;
}

export interface ReconcilerOptions {
  registry: AssetRegistry;
  inventory: LedgerInventory;
  riskGuard: SolverRiskGuard;
  usdPrice: (asset: string) => FloatLib.FloatFixed | null;
  /** Absolute USD drift tolerated per asset before halting. */
  maxDriftUsd: FloatLib.FloatFixed;
}

const HALT_REASON = 'reconciliation_divergence';

export class Reconciler {
  /** Total USD value at the last successful reconcile; null until baseline. */
  private lastTotalValueUsd: FloatLib.FloatFixed | null = null;

  constructor(private readonly opts: ReconcilerOptions) {}

  async reconcile(fetcher: OnChainBalanceFetcher): Promise<ReconcileReport> {
    const { registry, inventory, riskGuard, usdPrice, maxDriftUsd } = this.opts;
    const assets = [...registry.keys()];

    // May throw (RPC down): by design nothing below runs, no state changes.
    const actual = await fetcher.fetchBalances(assets);

    const drifts: AssetDrift[] = [];
    let halted = false;
    let totalValueUsd: FloatLib.FloatFixed | null = FloatLib.ZERO;

    for (const asset of assets) {
      const info = registry.get(asset)!;
      const expectedRaw = inventory.availableRaw(asset);
      const actualRaw = actual.get(asset) ?? 0n;
      const driftRaw = actualRaw - expectedRaw;

      const price = usdPrice(asset);
      let driftUsd: FloatLib.FloatFixed | null = null;

      if (price !== null) {
        const driftAbs = rawToFloat(driftRaw < 0n ? -driftRaw : driftRaw, info.decimals);
        driftUsd = FloatLib.times(driftAbs, price);
        if (FloatLib.isGT(driftUsd, maxDriftUsd)) halted = true;
        if (totalValueUsd !== null) {
          totalValueUsd = FloatLib.plus(
            totalValueUsd,
            FloatLib.times(rawToFloat(actualRaw, info.decimals), price)
          );
        }
      } else {
        // Unpriceable: we cannot size the damage, so ANY raw drift halts,
        // and the portfolio can no longer be marked this cycle.
        if (driftRaw !== 0n) halted = true;
        totalValueUsd = null;
      }

      drifts.push({ asset, expectedRaw, actualRaw, driftRaw, driftUsd });
    }

    if (halted) {
      riskGuard.tripKillSwitch(HALT_REASON);
      // Do NOT move the baseline on a halt: the next clean reconcile after a
      // human intervenes should not book the divergence as trading PnL.
      return { status: 'halted', drifts, pnlUsd: null };
    }

    let pnlUsd: FloatLib.FloatFixed | null = null;
    if (totalValueUsd !== null && this.lastTotalValueUsd !== null) {
      pnlUsd = FloatLib.minus(totalValueUsd, this.lastTotalValueUsd);
      riskGuard.recordRealizedPnlUsd(pnlUsd);
    }
    if (totalValueUsd !== null) {
      this.lastTotalValueUsd = totalValueUsd;
    }

    return { status: 'ok', drifts, pnlUsd };
  }
}
