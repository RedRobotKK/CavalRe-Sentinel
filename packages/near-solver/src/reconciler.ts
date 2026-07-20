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

// ============================================================================
// PENDING QUOTE BOOK (cross-check fix X1)
// ============================================================================

export interface PendingQuote {
  quoteId: string;
  assetIn: string;
  amountInRaw: bigint;
  assetOut: string;
  amountOutRaw: bigint;
  /** Quote deadline; entries stay matchable until deadline + graceMs. */
  deadlineMs: number;
}

/**
 * Every outbound quote is registered here so the reconciler can tell a
 * settled fill apart from unexplained divergence. Entries expire at
 * deadline + grace (settlement can land slightly after the deadline).
 */
export class PendingQuoteBook {
  private readonly quotes = new Map<string, PendingQuote>();

  constructor(private readonly opts: { graceMs: number; now: () => number }) {}

  register(quote: PendingQuote): void {
    this.quotes.set(quote.quoteId, quote);
  }

  pending(): PendingQuote[] {
    const cutoff = this.opts.now();
    for (const [id, q] of this.quotes) {
      if (q.deadlineMs + this.opts.graceMs < cutoff) this.quotes.delete(id);
    }
    return [...this.quotes.values()];
  }

  remove(quoteId: string): void {
    this.quotes.delete(quoteId);
  }
}

export interface AssetDrift {
  asset: string;
  expectedRaw: bigint;
  actualRaw: bigint;
  driftRaw: bigint; // actual - expected
  driftUsd: FloatLib.FloatFixed | null; // null when unpriceable
}

export interface InferredFill {
  quoteId: string;
  txHash: string; // synthetic marker; the real hash arrives out-of-band
}

export interface ReconcileReport {
  status: 'ok' | 'halted';
  drifts: AssetDrift[];
  /** Fills recognized from pending quotes and applied to the ledger this cycle. */
  inferredFills: InferredFill[];
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
  /** Outbound quotes awaiting settlement — enables fill inference (X1). */
  pendingQuotes?: PendingQuoteBook | undefined;
  /** Reservation holder to release when a fill is inferred. */
  reservations?: { release(quoteId: string): void } | undefined;
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

    // ---- Fill inference (X1): explain drift with pending quotes FIRST ----
    // A settled fill moves chain balances before anything moves the ledger.
    // Drift that exactly fits a registered quote's amounts IS that fill:
    // apply it, release its hold. Anything unexplained still halts below.
    const inferredFills: InferredFill[] = [];
    if (this.opts.pendingQuotes) {
      const residual = new Map<string, bigint>();
      for (const asset of assets) {
        residual.set(asset, (actual.get(asset) ?? 0n) - inventory.availableRaw(asset));
      }
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const q of this.opts.pendingQuotes.pending()) {
          const dIn = residual.get(q.assetIn) ?? 0n;
          const dOut = residual.get(q.assetOut) ?? 0n;
          if (dIn >= q.amountInRaw && dOut <= -q.amountOutRaw) {
            const txHash = `inferred:${q.quoteId}`;
            this.opts.reservations?.release(q.quoteId);
            inventory.applyFill({
              assetIn: q.assetIn,
              amountInRaw: q.amountInRaw,
              assetOut: q.assetOut,
              amountOutRaw: q.amountOutRaw,
              txHash,
            });
            residual.set(q.assetIn, dIn - q.amountInRaw);
            residual.set(q.assetOut, dOut + q.amountOutRaw);
            this.opts.pendingQuotes.remove(q.quoteId);
            inferredFills.push({ quoteId: q.quoteId, txHash });
            progressed = true;
          }
        }
      }
    }

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
      return { status: 'halted', drifts, inferredFills, pnlUsd: null };
    }

    let pnlUsd: FloatLib.FloatFixed | null = null;
    if (totalValueUsd !== null && this.lastTotalValueUsd !== null) {
      pnlUsd = FloatLib.minus(totalValueUsd, this.lastTotalValueUsd);
      riskGuard.recordRealizedPnlUsd(pnlUsd);
    }
    if (totalValueUsd !== null) {
      this.lastTotalValueUsd = totalValueUsd;
    }

    return { status: 'ok', drifts, inferredFills, pnlUsd };
  }
}
