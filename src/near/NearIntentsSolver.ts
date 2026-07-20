/**
 * NEAR INTENTS SOLVER ADAPTER
 *
 * Connects Sentinel's decision + risk engines to the NEAR Intents
 * solver network (Message Bus / solver relay).
 *
 * Flow (market-maker side):
 *   1. Connect to solver relay WebSocket and subscribe to "quote" events
 *   2. For each quote request: price it via TradeDecisionEngine
 *   3. Validate against RiskValidator hard limits (position size, daily loss, drawdown)
 *   4. Respond with a signed NEP-413 quote_response
 *   5. Subscribe to "quote_status" for settlement notifications -> feed
 *      settled trades back into training data (real labels, not mock)
 *
 * Endpoints (see docs/NEAR_INTEGRATION.md):
 *   WebSocket: wss://solver-relay-v2.chaindefuser.com/ws
 *   RPC:       https://solver-relay-v2.chaindefuser.com/rpc  (X-API-Key required)
 *   Verifier:  intents.near
 *
 * SAFETY: dryRun defaults to TRUE. In dry-run mode the solver prices quotes
 * and logs decisions but never signs or submits quote responses.
 */

/**
 * Minimal WebSocket surface we rely on. Satisfied by Node >= 21 global WebSocket
 * or the `ws` package. Keeps this module dependency-free and typecheckable
 * without DOM libs.
 */
interface MinimalWebSocket {
  onopen: (() => void) | null;
  onmessage: ((msg: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}
declare const WebSocket: new (url: string) => MinimalWebSocket;

import { RiskValidator } from '../lib/RiskValidator';
import { TradeDecisionEngine } from '../lib/TradeDecisionEngine';
import { StructuredLogger } from '../lib/StructuredLogger';
import { MetricsCollector } from '../lib/MetricsCollector';
import { CircuitBreakerManager } from '../lib/CircuitBreaker';

// ============================================================================
// CONSTANTS - no magic numbers
// ============================================================================

export const SOLVER_RELAY_WS_URL = 'wss://solver-relay-v2.chaindefuser.com/ws';
export const SOLVER_RELAY_RPC_URL = 'https://solver-relay-v2.chaindefuser.com/rpc';
export const INTENTS_VERIFIER_CONTRACT = 'intents.near';

/** Quote deadline we commit to. Shorter = less inventory risk. */
const QUOTE_VALIDITY_MS = 60_000;
/** Reconnect backoff bounds for the relay WebSocket. */
const WS_RECONNECT_MIN_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;
/** Skip quotes below this notional (USD) - not worth gas/inventory risk. */
const MIN_QUOTE_NOTIONAL_USD = 10;

// ============================================================================
// TYPES
// ============================================================================

/** Incoming quote request event from the solver bus. */
export interface QuoteRequestEvent {
  quote_id: string;
  defuse_asset_identifier_in: string; // e.g. "nep141:usdc.near"
  defuse_asset_identifier_out: string;
  exact_amount_in?: string; // raw token units as decimal string
  exact_amount_out?: string;
  min_deadline_ms: number;
}

/** Our priced response before signing. */
export interface QuoteDecision {
  quoteId: string;
  shouldQuote: boolean;
  reason: string;
  amountIn?: string;
  amountOut?: string;
  markupBps?: number;
  riskChecksPassed: boolean;
}

/** Settlement notification -> real training label. */
export interface SettlementEvent {
  quote_hash: string;
  intent_hash: string;
  tx_hash: string;
}

export interface NearSolverConfig {
  /** NEAR account the solver signs as (e.g. "sentinel-solver.near"). */
  signerId: string;
  /** ed25519 public key string. Private key must come from env/keystore, never config. */
  publicKey: string;
  /** JWT from the NEAR Intents partner portal, for RPC calls. */
  apiKey?: string;
  /** Asset pairs we are willing to quote. */
  allowedAssets: string[];
  /** DRY RUN: price + log, never sign or respond. Default true. */
  dryRun: boolean;
}

export const DEFAULT_NEAR_SOLVER_CONFIG: Omit<NearSolverConfig, 'signerId' | 'publicKey'> = {
  allowedAssets: [
    'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', // USDC on NEAR
    'nep141:wrap.near',
  ],
  dryRun: true,
};

// ============================================================================
// SOLVER
// ============================================================================

export class NearIntentsSolver {
  private readonly config: NearSolverConfig;
  private ws: MinimalWebSocket | null = null;
  private reconnectDelayMs = WS_RECONNECT_MIN_MS;
  private running = false;
  private rpcId = 0;

  constructor(
    private readonly riskValidator: RiskValidator,
    private readonly decisionEngine: TradeDecisionEngine,
    private readonly logger: StructuredLogger,
    private readonly metrics: MetricsCollector,
    private readonly circuitBreakers: CircuitBreakerManager,
    config: Partial<NearSolverConfig> & Pick<NearSolverConfig, 'signerId' | 'publicKey'>
  ) {
    this.config = { ...DEFAULT_NEAR_SOLVER_CONFIG, ...config };
  }

  /** Connect to the solver relay and start quoting. */
  async start(): Promise<void> {
    this.running = true;
    this.connect();
    this.logger.info('near_solver_started', {
      signerId: this.config.signerId,
      dryRun: this.config.dryRun,
      allowedAssets: this.config.allowedAssets,
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.ws?.close();
    this.ws = null;
    this.logger.info('near_solver_stopped', {});
  }

  // --------------------------------------------------------------------------
  // Pricing + risk
  // --------------------------------------------------------------------------

  /**
   * Decide whether/how to quote. Pure function of request + engine state,
   * so it is unit-testable without a live connection.
   */
  async decideQuote(event: QuoteRequestEvent): Promise<QuoteDecision> {
    const base: QuoteDecision = {
      quoteId: event.quote_id,
      shouldQuote: false,
      reason: '',
      riskChecksPassed: false,
    };

    // 1. Asset allowlist - never quote assets we don't understand
    if (
      !this.config.allowedAssets.includes(event.defuse_asset_identifier_in) ||
      !this.config.allowedAssets.includes(event.defuse_asset_identifier_out)
    ) {
      return { ...base, reason: 'asset_not_allowed' };
    }

    // 2. Exactly one side must be specified (per protocol)
    if (!!event.exact_amount_in === !!event.exact_amount_out) {
      return { ...base, reason: 'invalid_request_both_or_neither_amounts' };
    }

    // 3. Notional floor - dust quotes lose money on overhead
    //    TODO(pricing): convert raw units -> USD via oracle before comparing.
    //    Until the oracle is wired, treat unknown notional as below-floor and skip.
    const notionalUsd = await this.estimateNotionalUsd(event);
    if (notionalUsd === null || notionalUsd < MIN_QUOTE_NOTIONAL_USD) {
      return { ...base, reason: 'below_min_notional_or_unpriced' };
    }

    // 4. Hard risk limits (position size, daily loss, drawdown) - ABSOLUTE
    //    NOTE: intentionally fail-closed. Wire real capital/positions state in
    //    before enabling live quoting.
    const riskOk = this.checkRiskLimits(notionalUsd);
    if (!riskOk) {
      this.metrics.increment('near_solver.quotes_rejected_risk');
      return { ...base, reason: 'risk_limit_exceeded' };
    }

    // 5. Price it. TODO(pricing): pull inventory + reference price, apply
    //    learned markup from the decision engine once trained on REAL settlements.
    return {
      ...base,
      shouldQuote: true,
      reason: 'ok',
      riskChecksPassed: true,
      amountIn: event.exact_amount_in,
      // Placeholder pricing: must be replaced before live mode. Guarded by dryRun.
      amountOut: undefined,
      markupBps: undefined,
    };
  }

  /**
   * Estimate USD notional of a quote request.
   * Returns null when unpriceable (fail-closed: caller must skip).
   */
  private async estimateNotionalUsd(_event: QuoteRequestEvent): Promise<number | null> {
    // TODO(oracle): integrate price oracle (e.g. Pyth on NEAR, or ref.finance TWAP).
    return null; // fail-closed until oracle exists
  }

  private checkRiskLimits(_notionalUsd: number): boolean {
    // TODO(state): pass real capital / open-position state into RiskValidator.
    // Fail-closed default: no live state -> no quote.
    return false;
  }

  // --------------------------------------------------------------------------
  // WebSocket plumbing
  // --------------------------------------------------------------------------

  private connect(): void {
    if (!this.running) return;

    this.ws = new WebSocket(SOLVER_RELAY_WS_URL);

    this.ws.onopen = () => {
      this.reconnectDelayMs = WS_RECONNECT_MIN_MS;
      this.send({ jsonrpc: '2.0', id: ++this.rpcId, method: 'subscribe', params: ['quote'] });
      this.send({ jsonrpc: '2.0', id: ++this.rpcId, method: 'subscribe', params: ['quote_status'] });
      this.logger.info('near_solver_ws_connected', { url: SOLVER_RELAY_WS_URL });
    };

    this.ws.onmessage = (msg) => {
      void this.handleMessage(String(msg.data));
    };

    this.ws.onclose = () => {
      if (!this.running) return;
      this.logger.warn('near_solver_ws_closed_reconnecting', { delayMs: this.reconnectDelayMs });
      setTimeout(() => this.connect(), this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, WS_RECONNECT_MAX_MS);
    };

    this.ws.onerror = () => {
      this.metrics.increment('near_solver.ws_errors');
      this.ws?.close();
    };
  }

  private async handleMessage(raw: string): Promise<void> {
    let parsed: { method?: string; params?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.metrics.increment('near_solver.malformed_messages');
      return;
    }

    if (parsed.method !== 'subscribe' || !parsed.params) return;

    if ('quote_id' in parsed.params) {
      await this.onQuoteRequest(parsed.params as unknown as QuoteRequestEvent);
    } else if ('intent_hash' in parsed.params) {
      this.onSettlement(parsed.params as unknown as SettlementEvent);
    }
  }

  private async onQuoteRequest(event: QuoteRequestEvent): Promise<void> {
    this.metrics.increment('near_solver.quote_requests');
    const decision = await this.decideQuote(event);

    this.logger.info('near_solver_quote_decision', { ...decision });

    if (!decision.shouldQuote) return;

    if (this.config.dryRun) {
      this.metrics.increment('near_solver.dry_run_quotes');
      return; // never sign or respond in dry-run
    }

    // Live path: sign NEP-413 payload and send quote_response.
    // Deliberately unimplemented until pricing + risk state are real.
    throw new Error(
      'Live quoting not enabled: implement NEP-413 signing + pricing first (see docs/NEAR_INTEGRATION.md)'
    );
  }

  /** Settled intents are REAL labeled training data. Persist them. */
  private onSettlement(event: SettlementEvent): void {
    this.metrics.increment('near_solver.settlements_observed');
    this.logger.info('near_solver_settlement', { ...event });
    // TODO(data): append to data/near-settlements.jsonl for the training pipeline.
  }

  private send(payload: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify(payload));
  }
}
