/**
 * SOLVER PIPELINE
 *
 * Pure decision engine: quote request event -> quote decision.
 * No I/O, no clocks it doesn't own, no randomness — everything injected,
 * everything testable.
 *
 * Decision order (all fail-closed):
 *   1. assets listed        -> asset_not_listed
 *   2. mid price available  -> no_price
 *   3. price w/ half-spread, derive inventory skew, reprice w/ total spread
 *   4. inventory sufficient -> insufficient_inventory
 *   5. min notional         -> below_min_notional
 *   6. risk guard           -> guard's reason verbatim
 *
 * Inventory is backed by the CavalRe ledger (double-entry, halts on
 * overdraw) via LedgerInventory.
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import { Ledger } from '@cavalre/ledger-ts';
import type { QuoteRequestEvent } from './codec';
import { priceExactIn, priceExactOut, inventorySkewBps, floorToRaw, rawToFloat } from './pricing';
import type { SolverRiskGuard } from './risk';

// ============================================================================
// TYPES
// ============================================================================

export interface AssetInfo {
  symbol: string;
  decimals: bigint;
}

export type AssetRegistry = Map<string, AssetInfo>;

export interface PriceSource {
  /** Mid price: units of assetOut per unit of assetIn. Null = unpriceable. */
  mid(assetIn: string, assetOut: string): FloatLib.FloatFixed | null;
  /** USD price per whole unit of asset. Null = unpriceable. */
  usdPrice(asset: string): FloatLib.FloatFixed | null;
}

export interface InventoryView {
  availableRaw(asset: string): bigint;
}

export interface SolverConfig {
  signerId: string;
  halfSpreadBps: number;
  maxInventorySkewBps: number;
  quoteValidityMs: number;
  minNotionalUsd: FloatLib.FloatFixed;
}

export interface SolverDeps {
  registry: AssetRegistry;
  priceSource: PriceSource;
  inventory: InventoryView;
  riskGuard: SolverRiskGuard;
  config: SolverConfig;
  now: () => number;
}

export type QuoteDecision =
  | { shouldQuote: false; quoteId: string; reason: string }
  | {
      shouldQuote: true;
      quoteId: string;
      assetIn: string;
      assetOut: string;
      amountInRaw: bigint;
      amountOutRaw: bigint;
      totalSpreadBps: number;
      deadlineIso: string;
    };

// ============================================================================
// PIPELINE
// ============================================================================

export class SolverPipeline {
  constructor(private readonly deps: SolverDeps) {}

  decide(event: QuoteRequestEvent): QuoteDecision {
    const { registry, priceSource, inventory, riskGuard, config, now } = this.deps;
    const reject = (reason: string): QuoteDecision => ({
      shouldQuote: false,
      quoteId: event.quoteId,
      reason,
    });

    // 1. Asset allowlist
    const infoIn = registry.get(event.assetIn);
    const infoOut = registry.get(event.assetOut);
    if (!infoIn || !infoOut) return reject('asset_not_listed');

    // 2. Mid price
    const mid = priceSource.mid(event.assetIn, event.assetOut);
    if (mid === null) return reject('no_price');

    // 3. Price. First pass with half-spread only to estimate inventory
    //    utilization, then reprice with skew included (conservative).
    const availableOut = inventory.availableRaw(event.assetOut);
    let amountInRaw: bigint;
    let amountOutRaw: bigint;
    let totalSpreadBps: number;

    if (event.exactAmountIn !== undefined) {
      const preliminaryOut = priceExactIn({
        amountInRaw: event.exactAmountIn,
        decimalsIn: infoIn.decimals,
        decimalsOut: infoOut.decimals,
        mid,
        totalSpreadBps: config.halfSpreadBps,
      });
      const skew = inventorySkewBps({
        amountOutRaw: preliminaryOut,
        availableRaw: availableOut,
        maxSkewBps: config.maxInventorySkewBps,
      });
      totalSpreadBps = config.halfSpreadBps + skew;
      amountInRaw = event.exactAmountIn;
      amountOutRaw = priceExactIn({
        amountInRaw: event.exactAmountIn,
        decimalsIn: infoIn.decimals,
        decimalsOut: infoOut.decimals,
        mid,
        totalSpreadBps,
      });
    } else if (event.exactAmountOut !== undefined) {
      amountOutRaw = event.exactAmountOut;
      const skew = inventorySkewBps({
        amountOutRaw,
        availableRaw: availableOut,
        maxSkewBps: config.maxInventorySkewBps,
      });
      totalSpreadBps = config.halfSpreadBps + skew;
      amountInRaw = priceExactOut({
        amountOutRaw,
        decimalsIn: infoIn.decimals,
        decimalsOut: infoOut.decimals,
        mid,
        totalSpreadBps,
      });
    } else {
      return reject('missing_amount');
    }

    // 4. Inventory: can we actually pay out?
    if (amountOutRaw > availableOut) return reject('insufficient_inventory');

    // 5. Notional in USD (fail-closed if unpriceable)
    const usdIn = priceSource.usdPrice(event.assetIn);
    const notionalUsd =
      usdIn === null
        ? null
        : FloatLib.times(rawToFloat(amountInRaw, infoIn.decimals), usdIn);

    if (notionalUsd !== null && FloatLib.isLT(notionalUsd, config.minNotionalUsd)) {
      return reject('below_min_notional');
    }

    // 6. Hard risk limits
    const verdict = riskGuard.checkQuote({ notionalUsd });
    if (!verdict.allowed) return reject(verdict.reason);

    const deadlineMs = Math.max(config.quoteValidityMs, event.minDeadlineMs);
    return {
      shouldQuote: true,
      quoteId: event.quoteId,
      assetIn: event.assetIn,
      assetOut: event.assetOut,
      amountInRaw,
      amountOutRaw,
      totalSpreadBps,
      deadlineIso: new Date(now() + deadlineMs).toISOString(),
    };
  }
}

// ============================================================================
// LEDGER-BACKED INVENTORY (CavalRe double-entry accounting)
// ============================================================================

const SOLVER_ACCOUNT = 'solver';
const GENESIS_BLOCK = 0n;

/**
 * Solver inventory tracked in the CavalRe ledger: every fill is a
 * double-entry event, overdraws throw before any state changes,
 * and the ledger's divergence detection can later reconcile against
 * on-chain intents.near balances.
 */
export class LedgerInventory implements InventoryView {
  private readonly ledger = new Ledger();
  private blockCounter = GENESIS_BLOCK;

  constructor(private readonly registry: AssetRegistry) {}

  deposit(asset: string, amountRaw: bigint, txHash: string): void {
    const info = this.requireAsset(asset);
    this.ledger.applyBalanceChange({
      account: SOLVER_ACCOUNT,
      token: asset,
      amount: rawToFloat(amountRaw, info.decimals),
      type: 'deposit',
      txHash,
      blockNumber: ++this.blockCounter,
    });
  }

  availableRaw(asset: string): bigint {
    const info = this.registry.get(asset);
    if (!info) return 0n;
    const balance = this.ledger.getBalance(SOLVER_ACCOUNT, asset);
    return floorToRaw(balance, info.decimals);
  }

  /**
   * Apply a settled fill atomically: check the outgoing leg BEFORE touching
   * state, then record both legs. Throws on overdraw.
   */
  applyFill(fill: {
    assetIn: string;
    amountInRaw: bigint;
    assetOut: string;
    amountOutRaw: bigint;
    txHash: string;
  }): void {
    const infoIn = this.requireAsset(fill.assetIn);
    const infoOut = this.requireAsset(fill.assetOut);

    if (fill.amountOutRaw > this.availableRaw(fill.assetOut)) {
      throw new Error(
        `inventory overdraw: fill ${fill.txHash} pays ${fill.amountOutRaw} of ${fill.assetOut}, ` +
          `available ${this.availableRaw(fill.assetOut)}`
      );
    }

    const block = ++this.blockCounter;
    this.ledger.applyBalanceChange({
      account: SOLVER_ACCOUNT,
      token: fill.assetIn,
      amount: rawToFloat(fill.amountInRaw, infoIn.decimals),
      type: 'deposit',
      txHash: fill.txHash,
      blockNumber: block,
    });
    this.ledger.applyBalanceChange({
      account: SOLVER_ACCOUNT,
      token: fill.assetOut,
      amount: rawToFloat(fill.amountOutRaw, infoOut.decimals),
      type: 'withdrawal',
      txHash: fill.txHash,
      blockNumber: block,
    });
  }

  private requireAsset(asset: string): AssetInfo {
    const info = this.registry.get(asset);
    if (!info) throw new Error(`asset not in registry: ${asset}`);
    return info;
  }
}
