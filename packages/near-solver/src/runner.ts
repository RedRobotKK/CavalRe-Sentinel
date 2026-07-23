/**
 * SOLVER RUNNER — composition root.
 *
 * IntentRegister owns lifecycle + reserve/release transitions.
 * PendingQuoteBook remains for reconciler fill-inference until fully replaced.
 * Maintenance tick: sweepExpired + outbox.drain so idle periods still free holds
 * and retry publishes.
 */

import { createHash, randomBytes, type KeyObject } from 'node:crypto';
import * as FloatLib from '@cavalre/floatlib-ts';
import {
  buildQuoteResponse,
  buildTokenDiffMessage,
  type QuoteRequestEvent,
  type SettlementEvent,
} from './codec.js';
import { signNep413 } from './nep413.js';
import { rawToFloat } from './pricing.js';
import type { DecisionJournal } from './journal.js';
import { PendingQuoteBook } from './reconciler.js';
import { IntentRegister } from './intentRegister.js';
import { RelayClient, type TransportFactory } from './relay.js';
import type { SolverRiskGuard } from './risk.js';
import {
  LedgerInventory,
  ReservingInventory,
  SolverPipeline,
  type AssetRegistry,
  type PriceSource,
  type SolverConfig,
} from './solver.js';

const INTENTS_VERIFIER = 'intents.near';
const NONCE_BYTES = 32;
const SETTLEMENT_GRACE_MS = 30_000;
/** Idle maintenance: expire holds + drain outbox without waiting for next quote. */
const MAINTENANCE_MS = 5_000;

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
  dryRun?: boolean;
  privateKey?: KeyObject;
  journal?: DecisionJournal;
  now?: () => number;
  /** Override maintenance interval (tests). 0 = disable timer. */
  maintenanceMs?: number;
}

export class SolverRunner {
  readonly inventory: ReservingInventory;
  readonly pendingQuotes: PendingQuoteBook;
  readonly register: IntentRegister;
  readonly metrics: RunnerMetrics = { counters: {} };

  private readonly pipeline: SolverPipeline;
  private readonly relay: RelayClient;
  private readonly dryRun: boolean;
  private readonly now: () => number;
  private readonly maintenanceMs: number;
  private maintenanceTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: SolverRunnerOptions) {
    this.dryRun = opts.dryRun ?? true;
    this.now = opts.now ?? Date.now;
    this.maintenanceMs = opts.maintenanceMs ?? MAINTENANCE_MS;
    this.inventory = new ReservingInventory(opts.baseInventory, this.now);
    this.pendingQuotes = new PendingQuoteBook({ graceMs: SETTLEMENT_GRACE_MS, now: this.now });
    this.register = new IntentRegister({
      inventory: this.inventory,
      mode: this.dryRun ? 'dry_run' : 'live',
      now: this.now,
      graceMs: SETTLEMENT_GRACE_MS,
      killSwitchActive: () => this.opts.riskGuard.state.killSwitch !== null,
    });
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

  get relayStats(): { framesReceived: number; malformedFrames: number; reconnects: number } {
    return this.relay.stats;
  }

  injectQuoteRequest(event: QuoteRequestEvent): void {
    this.onQuoteRequest(event);
  }

  /** Test / ops: run one maintenance cycle. */
  runMaintenance(): void {
    const expired = this.register.sweepExpired();
    if (expired.length > 0) {
      this.count('register:expired_sweep');
      for (const r of expired) {
        this.pendingQuotes.remove(r.quote_id);
      }
    }
    if (!this.dryRun) {
      void this.register.outbox.drain((row) => {
        this.relay.sendFrame(row.payload);
        return { ok: true };
      });
    }
  }

  start(): void {
    if (!this.dryRun && !this.opts.privateKey) {
      throw new Error('live mode requires a private key; refusing to start');
    }
    this.relay.start();
    if (this.maintenanceMs > 0 && this.maintenanceTimer === null) {
      this.maintenanceTimer = setInterval(() => this.runMaintenance(), this.maintenanceMs);
      // unref so Node can exit in tests if only timer remains
      if (typeof this.maintenanceTimer === 'object' && 'unref' in this.maintenanceTimer) {
        this.maintenanceTimer.unref();
      }
    }
  }

  stop(): void {
    if (this.maintenanceTimer !== null) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    this.relay.stop();
  }

  private count(key: string): void {
    this.metrics.counters[key] = (this.metrics.counters[key] ?? 0) + 1;
  }

  private onQuoteRequest(event: QuoteRequestEvent): void {
    this.register.sweepExpired();

    const observed = this.register.observe(event);
    if (!observed.ok && observed.err === 'conflict') {
      this.count('quote_decision:request_conflict');
      return;
    }

    const decision = this.pipeline.decide(event);
    this.opts.journal?.recordDecision(event, decision);

    const applied = this.register.applyDecision(event.quoteId, decision);
    if (!applied.ok) {
      if (applied.detail === 'reserve_failed' || applied.err === 'guard_failed') {
        this.count(
          applied.detail === 'kill_switch'
            ? 'quote_decision:kill_switch'
            : 'quote_decision:reservation_conflict'
        );
        return;
      }
      if (!decision.shouldQuote) {
        this.count(`quote_decision:${decision.reason}`);
      } else {
        this.count(`quote_decision:register_${applied.err}`);
      }
      return;
    }

    if (!decision.shouldQuote) {
      this.count(`quote_decision:${decision.reason}`);
      return;
    }

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
      this.opts.privateKey!
    );
    const frame = buildQuoteResponse({
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
    });

    const quoteHash = createHash('sha256').update(frame).digest('hex');

    const sent = this.register.markSent(decision.quoteId, {
      quoteHash,
      framePayload: frame,
      signerId: this.opts.solverConfig.signerId,
    });
    if (!sent.ok) {
      this.count(`quote_decision:mark_sent_${sent.err}`);
      this.inventory.release(decision.quoteId);
      return;
    }

    void this.register.outbox.drain((row) => {
      this.relay.sendFrame(row.payload);
      return { ok: true };
    });

    this.count('quote_decision:quoted_live');
  }

  private onSettlement(event: SettlementEvent): void {
    this.count('settlement:observed');

    const existing = this.register.getByHash(event.quoteHash);
    if (!existing) {
      this.count('settlement:deferred_to_reconciler');
      return;
    }

    const result = this.register.markSettled(
      { quoteHash: event.quoteHash },
      { intentHash: event.intentHash, txHash: event.txHash },
      (r) => {
        this.inventory.commit(r.quote_id, {
          assetIn: r.asset_in,
          amountInRaw: BigInt(r.quote_amount_in_raw ?? '0'),
          assetOut: r.asset_out,
          amountOutRaw: BigInt(r.quote_amount_out_raw ?? '0'),
          txHash: event.txHash,
        });
      }
    );

    if (result.ok) {
      this.count(
        result.outcome === 'noop' ? 'settlement:noop' : 'settlement:register_filled'
      );
      this.pendingQuotes.remove(existing.quote_id);
    } else {
      this.count(`settlement:register_${result.err}`);
      this.count('settlement:deferred_to_reconciler');
    }
  }
}

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
