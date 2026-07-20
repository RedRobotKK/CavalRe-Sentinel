/**
 * SOLVER RUNNER — composition root.
 *
 * Safety posture (SRE-reviewed):
 *  - dryRun defaults to TRUE. Live mode requires BOTH an explicit
 *    dryRun:false AND a private key; refusing to start beats quoting blind.
 *  - Reservations happen in dry-run too, so dry-run traffic exercises the
 *    exact code path live traffic will.
 *  - Nonces are crypto-random per quote. Never fixtures, never reused.
 *  - Metrics: every decision outcome is counted by reason; no secret
 *    material is ever logged or exported.
 */

import { randomBytes, type KeyObject } from 'node:crypto';
import * as FloatLib from '@cavalre/floatlib-ts';
import {
  buildQuoteResponse,
  buildTokenDiffMessage,
  type QuoteRequestEvent,
  type SettlementEvent,
} from './codec';
import { signNep413 } from './nep413';
import { rawToFloat } from './pricing';
import type { DecisionJournal } from './journal';
import { PendingQuoteBook } from './reconciler';
import { RelayClient, type TransportFactory } from './relay';
import type { SolverRiskGuard } from './risk';
import {
  LedgerInventory,
  ReservingInventory,
  SolverPipeline,
  type AssetRegistry,
  type PriceSource,
  type SolverConfig,
} from './solver';

const INTENTS_VERIFIER = 'intents.near';
const NONCE_BYTES = 32;
/** Fills can settle slightly after the quote deadline; keep book entries matchable this long. */
const SETTLEMENT_GRACE_MS = 30_000;

export interface RunnerMetrics {
  counters: Record<string, number>;
}

export interface SolverRunnerOptions {
  registry: AssetRegistry;
  priceSource: PriceSource;
  baseInventory: LedgerInventory;
  riskGuard: SolverRiskGuard;
  solverConfig: SolverConfig;
  relay: {
    url: string;
    transportFactory: TransportFactory;
    reconnectMinMs: number;
    reconnectMaxMs: number;
  };
  /** SAFE DEFAULT: true. Live quoting requires an explicit false AND a key. */
  dryRun?: boolean;
  privateKey?: KeyObject;
  /** The tape (X9): records every decision. Strongly recommended from G2 on. */
  journal?: DecisionJournal;
  now?: () => number;
}

export class SolverRunner {
  readonly inventory: ReservingInventory;
  /** Outbound quotes awaiting settlement; hand this to the Reconciler. */
  readonly pendingQuotes: PendingQuoteBook;
  readonly metrics: RunnerMetrics = { counters: {} };

  private readonly pipeline: SolverPipeline;
  private readonly relay: RelayClient;
  private readonly dryRun: boolean;
  private readonly now: () => number;

  constructor(private readonly opts: SolverRunnerOptions) {
    this.dryRun = opts.dryRun ?? true;
    this.now = opts.now ?? Date.now;
    this.inventory = new ReservingInventory(opts.baseInventory, this.now);
    this.pendingQuotes = new PendingQuoteBook({ graceMs: SETTLEMENT_GRACE_MS, now: this.now });
    this.pipeline = new SolverPipeline({
      registry: opts.registry,
      priceSource: opts.priceSource,
      inventory: this.inventory,
      riskGuard: opts.riskGuard,
      config: opts.solverConfig,
      now: this.now,
    });
    this.relay = new RelayClient({
      url: opts.relay.url,
      transportFactory: opts.relay.transportFactory,
      reconnectMinMs: opts.relay.reconnectMinMs,
      reconnectMaxMs: opts.relay.reconnectMaxMs,
      onQuoteRequest: (e) => this.onQuoteRequest(e),
      onSettlement: (e) => this.onSettlement(e),
    });
  }

  start(): void {
    if (!this.dryRun && !this.opts.privateKey) {
      throw new Error('live mode requires a private key; refusing to start');
    }
    this.relay.start();
  }

  stop(): void {
    this.relay.stop();
  }

  private count(key: string): void {
    this.metrics.counters[key] = (this.metrics.counters[key] ?? 0) + 1;
  }

  private onQuoteRequest(event: QuoteRequestEvent): void {
    const decision = this.pipeline.decide(event);
    this.opts.journal?.recordDecision(event, decision);
    if (!decision.shouldQuote) {
      this.count(`quote_decision:${decision.reason}`);
      return;
    }

    // Hold the payout for the quote's lifetime — dry-run included, so both
    // modes exercise identical inventory behavior.
    const reserved = this.inventory.reserve(
      decision.quoteId,
      decision.assetOut,
      decision.amountOutRaw,
      Date.parse(decision.deadlineIso)
    );
    if (!reserved) {
      this.count('quote_decision:reservation_conflict');
      return;
    }

    // Register for fill inference (X1) — dry-run included, for parity.
    this.pendingQuotes.register({
      quoteId: decision.quoteId,
      assetIn: decision.assetIn,
      amountInRaw: decision.amountInRaw,
      assetOut: decision.assetOut,
      amountOutRaw: decision.amountOutRaw,
      deadlineMs: Date.parse(decision.deadlineIso),
    });

    if (this.dryRun) {
      this.count('quote_decision:would_quote_dry_run');
      return;
    }

    const message = buildTokenDiffMessage({
      signerId: this.opts.solverConfig.signerId,
      deadlineIso: decision.deadlineIso,
      assetIn: decision.assetIn,
      amountIn: decision.amountInRaw,
      assetOut: decision.assetOut,
      amountOut: decision.amountOutRaw,
    });
    const signed = signNep413(
      { message, nonce: new Uint8Array(randomBytes(NONCE_BYTES)), recipient: INTENTS_VERIFIER },
      this.opts.privateKey! // presence enforced in start()
    );
    this.relay.sendFrame(
      buildQuoteResponse({
        rpcId: this.relay.nextRpcId(),
        quoteId: decision.quoteId,
        quoteOutput:
          event.exactAmountIn !== undefined
            ? { amountOut: decision.amountOutRaw }
            : { amountIn: decision.amountInRaw },
        signedData: {
          standard: 'nep413',
          payload: { message, nonce: signed.nonceBase64, recipient: INTENTS_VERIFIER },
          publicKey: signed.publicKeyString,
          signature: `ed25519:${signed.signatureBase64}`,
        },
      })
    );
    this.count('quote_decision:quoted_live');
  }

  private onSettlement(event: SettlementEvent): void {
    // Settlement-to-quote matching requires tracking our quote hashes from
    // relay acks; until that lands, settlements are counted for observability
    // and reconciliation stays manual. Reservations self-expire regardless.
    this.count('settlement:observed');
    void event;
  }
}

// ============================================================================
// REALIZED EDGE
// ============================================================================

/**
 * USD edge captured on a fill: value received minus value paid.
 * Null (fail-closed) if either leg is unpriceable — feed nothing into the
 * risk guard rather than a fabricated number.
 */
export function realizedEdgeUsd(params: {
  assetIn: string;
  amountInRaw: bigint;
  decimalsIn: bigint;
  assetOut: string;
  amountOutRaw: bigint;
  decimalsOut: bigint;
  usdPrice: (asset: string) => FloatLib.FloatFixed | null;
}): FloatLib.FloatFixed | null {
  const usdIn = params.usdPrice(params.assetIn);
  const usdOut = params.usdPrice(params.assetOut);
  if (usdIn === null || usdOut === null) return null;
  const valueIn = FloatLib.times(rawToFloat(params.amountInRaw, params.decimalsIn), usdIn);
  const valueOut = FloatLib.times(rawToFloat(params.amountOutRaw, params.decimalsOut), usdOut);
  return FloatLib.minus(valueIn, valueOut);
}
