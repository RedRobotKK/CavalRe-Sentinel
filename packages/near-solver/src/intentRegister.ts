/**
 * INTENT REGISTER — lifecycle + inventory transitions + transactional outbox.
 */

import type { QuoteRequestEvent } from './codec.js';
import type { QuoteDecision } from './solver.js';
import type { ReservingInventory } from './solver.js';
import { Outbox, type OutboxRow } from './outbox.js';

export type IntentState =
  | 'seen'
  | 'decided_reject'
  | 'reserved'
  | 'sent'
  | 'settled'
  | 'expired'
  | 'released';

export type IntentSource = 'bus' | 'cover' | 'sim';
export type IntentMode = 'dry_run' | 'live';

export type TerminalReason =
  | 'rejected'
  | 'expired'
  | 'settled'
  | 'released'
  | 'inventory_error'
  | null;

export interface IntentRecord {
  quote_id: string;
  quote_hash: string | null;
  intent_hash: string | null;
  tx_hash: string | null;
  asset_in: string;
  asset_out: string;
  side: 'exact_in' | 'exact_out';
  amount_in_raw: string | null;
  amount_out_raw: string | null;
  min_deadline_ms: number;
  request_fingerprint: string;
  state: IntentState;
  decided_at_ms: number | null;
  should_quote: boolean | null;
  reason: string | null;
  quote_amount_in_raw: string | null;
  quote_amount_out_raw: string | null;
  total_spread_bps: number | null;
  deadline_iso: string | null;
  reserved: boolean;
  reserve_asset: string | null;
  reserve_amount_raw: string | null;
  reserve_expires_at_ms: number | null;
  sent_at_ms: number | null;
  signer_id: string | null;
  terminal_at_ms: number | null;
  terminal_reason: TerminalReason;
  source: IntentSource;
  mode: IntentMode;
  schema_version: 1;
}

export type TransitionOutcome = 'applied' | 'noop';

export type TransitionResult =
  | { ok: true; outcome: TransitionOutcome; record: IntentRecord }
  | { ok: false; err: string; detail?: string };

const TERMINAL: ReadonlySet<IntentState> = new Set([
  'decided_reject',
  'settled',
  'expired',
  'released',
]);

const ALLOWED: Record<IntentState, IntentState[]> = {
  seen: ['decided_reject', 'reserved'],
  reserved: ['expired', 'released', 'sent'],
  sent: ['settled', 'expired', 'released'],
  decided_reject: [],
  settled: [],
  expired: [],
  released: [],
};

export const OUTBOX_TOPIC_QUOTE_RESPONSE = 'quote_response';
export const OUTBOX_TOPIC_JOURNAL = 'journal';

export interface IntentRegisterOptions {
  inventory: ReservingInventory;
  outbox?: Outbox;
  now?: () => number;
  graceMs?: number;
  mode: IntentMode;
  source?: IntentSource;
  killSwitchActive?: () => boolean;
}

export class IntentRegister {
  private readonly byId = new Map<string, IntentRecord>();
  private readonly byHash = new Map<string, string>();
  private readonly appliedFills = new Set<string>();
  readonly outbox: Outbox;
  private readonly inventory: ReservingInventory;
  private readonly now: () => number;
  private readonly graceMs: number;
  private readonly mode: IntentMode;
  private readonly defaultSource: IntentSource;
  private readonly killSwitchActive: () => boolean;

  constructor(opts: IntentRegisterOptions) {
    this.inventory = opts.inventory;
    this.outbox =
      opts.outbox ??
      (opts.now !== undefined ? new Outbox({ now: opts.now }) : new Outbox());
    this.now = opts.now ?? Date.now;
    this.graceMs = opts.graceMs ?? 30_000;
    this.mode = opts.mode;
    this.defaultSource = opts.source ?? 'bus';
    this.killSwitchActive = opts.killSwitchActive ?? (() => false);
  }

  get(quoteId: string): IntentRecord | undefined {
    return this.byId.get(quoteId);
  }

  getByHash(quoteHash: string): IntentRecord | undefined {
    const id = this.byHash.get(quoteHash);
    return id ? this.byId.get(id) : undefined;
  }

  /** Counts per lifecycle state — for status / ops. */
  countsByState(): Record<IntentState, number> {
    const c: Record<IntentState, number> = {
      seen: 0,
      decided_reject: 0,
      reserved: 0,
      sent: 0,
      settled: 0,
      expired: 0,
      released: 0,
    };
    for (const r of this.byId.values()) c[r.state] += 1;
    return c;
  }

  observe(
    event: QuoteRequestEvent,
    meta?: { source?: IntentSource }
  ): TransitionResult {
    const fp = requestFingerprint(event);
    const existing = this.byId.get(event.quoteId);
    if (existing) {
      if (existing.request_fingerprint === fp) {
        return { ok: true, outcome: 'noop', record: clone(existing) };
      }
      return {
        ok: false,
        err: 'conflict',
        detail: 'quote_id exists with different request fingerprint',
      };
    }
    const side = event.exactAmountIn !== undefined ? 'exact_in' : 'exact_out';
    const record: IntentRecord = {
      quote_id: event.quoteId,
      quote_hash: null,
      intent_hash: null,
      tx_hash: null,
      asset_in: event.assetIn,
      asset_out: event.assetOut,
      side,
      amount_in_raw: event.exactAmountIn !== undefined ? event.exactAmountIn.toString() : null,
      amount_out_raw: event.exactAmountOut !== undefined ? event.exactAmountOut.toString() : null,
      min_deadline_ms: event.minDeadlineMs,
      request_fingerprint: fp,
      state: 'seen',
      decided_at_ms: null,
      should_quote: null,
      reason: null,
      quote_amount_in_raw: null,
      quote_amount_out_raw: null,
      total_spread_bps: null,
      deadline_iso: null,
      reserved: false,
      reserve_asset: null,
      reserve_amount_raw: null,
      reserve_expires_at_ms: null,
      sent_at_ms: null,
      signer_id: null,
      terminal_at_ms: null,
      terminal_reason: null,
      source: meta?.source ?? this.defaultSource,
      mode: this.mode,
      schema_version: 1,
    };
    this.byId.set(record.quote_id, record);
    return { ok: true, outcome: 'applied', record: clone(record) };
  }

  applyDecision(quoteId: string, decision: QuoteDecision): TransitionResult {
    const r = this.byId.get(quoteId);
    if (!r) return { ok: false, err: 'not_found', detail: quoteId };

    if (r.state === 'decided_reject' && !decision.shouldQuote && r.reason === decision.reason) {
      return { ok: true, outcome: 'noop', record: clone(r) };
    }
    if (
      r.state === 'reserved' &&
      decision.shouldQuote &&
      r.quote_amount_out_raw === decision.amountOutRaw.toString() &&
      r.quote_amount_in_raw === decision.amountInRaw.toString()
    ) {
      return { ok: true, outcome: 'noop', record: clone(r) };
    }
    if (TERMINAL.has(r.state) || r.state === 'sent' || r.state === 'reserved') {
      if (r.state === 'reserved') {
        return { ok: false, err: 'conflict', detail: 'already reserved with different legs' };
      }
      return { ok: false, err: 'illegal_transition', detail: `${r.state}->decide` };
    }
    if (r.state !== 'seen') {
      return { ok: false, err: 'illegal_transition', detail: `${r.state}->decide` };
    }

    const t = this.now();
    if (!decision.shouldQuote) {
      assertEdge(r.state, 'decided_reject');
      r.should_quote = false;
      r.reason = decision.reason;
      r.decided_at_ms = t;
      r.state = 'decided_reject';
      r.terminal_at_ms = t;
      r.terminal_reason = 'rejected';
      return { ok: true, outcome: 'applied', record: clone(r) };
    }

    if (this.killSwitchActive()) {
      return { ok: false, err: 'guard_failed', detail: 'kill_switch' };
    }

    assertEdge(r.state, 'reserved');
    const expires = Date.parse(decision.deadlineIso);
    const ok = this.inventory.reserve(
      decision.quoteId,
      decision.assetOut,
      decision.amountOutRaw,
      expires
    );
    if (!ok) {
      if (r.reserved && r.reserve_amount_raw === decision.amountOutRaw.toString()) {
        return { ok: true, outcome: 'noop', record: clone(r) };
      }
      return { ok: false, err: 'guard_failed', detail: 'reserve_failed' };
    }

    r.should_quote = true;
    r.reason = null;
    r.decided_at_ms = t;
    r.quote_amount_in_raw = decision.amountInRaw.toString();
    r.quote_amount_out_raw = decision.amountOutRaw.toString();
    r.total_spread_bps = decision.totalSpreadBps;
    r.deadline_iso = decision.deadlineIso;
    r.reserved = true;
    r.reserve_asset = decision.assetOut;
    r.reserve_amount_raw = decision.amountOutRaw.toString();
    r.reserve_expires_at_ms = expires;
    r.state = 'reserved';
    return { ok: true, outcome: 'applied', record: clone(r) };
  }

  markSent(
    quoteId: string,
    params: { quoteHash: string; framePayload: string; signerId: string }
  ): TransitionResult {
    const r = this.byId.get(quoteId);
    if (!r) return { ok: false, err: 'not_found' };

    if (r.state === 'sent' && r.quote_hash === params.quoteHash) {
      return { ok: true, outcome: 'noop', record: clone(r) };
    }
    if (r.state === 'sent' && r.quote_hash !== params.quoteHash) {
      return { ok: false, err: 'conflict', detail: 'quote_hash mismatch' };
    }
    if (r.mode !== 'live' || this.mode !== 'live') {
      return { ok: false, err: 'guard_failed', detail: 'dry_run_cannot_send' };
    }
    if (r.state !== 'reserved') {
      return { ok: false, err: 'illegal_transition', detail: `${r.state}->sent` };
    }
    if (!params.quoteHash || !params.framePayload) {
      return { ok: false, err: 'guard_failed', detail: 'missing_hash_or_payload' };
    }

    assertEdge(r.state, 'sent');
    this.outbox.enqueue(OUTBOX_TOPIC_QUOTE_RESPONSE, quoteId, params.framePayload);
    const t = this.now();
    r.quote_hash = params.quoteHash;
    r.sent_at_ms = t;
    r.signer_id = params.signerId;
    r.state = 'sent';
    this.byHash.set(params.quoteHash, quoteId);
    return { ok: true, outcome: 'applied', record: clone(r) };
  }

  markSettled(
    ref: { quoteHash?: string; quoteId?: string },
    settlement: { intentHash: string; txHash: string },
    applyFill: (r: IntentRecord) => void
  ): TransitionResult {
    const r =
      (ref.quoteHash ? this.getByHash(ref.quoteHash) : undefined) ??
      (ref.quoteId ? this.byId.get(ref.quoteId) : undefined);
    if (!r) return { ok: false, err: 'not_found' };

    if (r.state === 'settled') {
      if (r.tx_hash === settlement.txHash) {
        return { ok: true, outcome: 'noop', record: clone(r) };
      }
      return { ok: false, err: 'conflict', detail: 'already settled with different tx' };
    }
    if (r.state !== 'sent' && r.state !== 'reserved') {
      return { ok: false, err: 'illegal_transition', detail: `${r.state}->settled` };
    }

    const fillKey = settlement.txHash || r.quote_id;
    if (this.appliedFills.has(fillKey)) {
      assertEdge(r.state, 'settled');
      r.state = 'settled';
      r.intent_hash = settlement.intentHash;
      r.tx_hash = settlement.txHash;
      r.terminal_at_ms = this.now();
      r.terminal_reason = 'settled';
      r.reserved = false;
      return { ok: true, outcome: 'noop', record: clone(r) };
    }

    assertEdge(r.state, 'settled');
    try {
      applyFill(r);
    } catch (e) {
      return {
        ok: false,
        err: 'guard_failed',
        detail: e instanceof Error ? e.message : 'fill_failed',
      };
    }
    this.appliedFills.add(fillKey);
    this.inventory.release(r.quote_id);
    r.reserved = false;
    r.intent_hash = settlement.intentHash;
    r.tx_hash = settlement.txHash;
    r.state = 'settled';
    r.terminal_at_ms = this.now();
    r.terminal_reason = 'settled';
    return { ok: true, outcome: 'applied', record: clone(r) };
  }

  markExpired(quoteId: string): TransitionResult {
    const r = this.byId.get(quoteId);
    if (!r) return { ok: false, err: 'not_found' };
    if (r.state === 'expired') return { ok: true, outcome: 'noop', record: clone(r) };
    if (TERMINAL.has(r.state)) {
      return { ok: false, err: 'illegal_transition', detail: `${r.state}->expired` };
    }
    if (r.state !== 'reserved' && r.state !== 'sent') {
      return { ok: false, err: 'illegal_transition', detail: `${r.state}->expired` };
    }
    assertEdge(r.state, 'expired');
    if (r.reserved) this.inventory.release(r.quote_id);
    r.reserved = false;
    r.state = 'expired';
    r.terminal_at_ms = this.now();
    r.terminal_reason = 'expired';
    return { ok: true, outcome: 'applied', record: clone(r) };
  }

  sweepExpired(): IntentRecord[] {
    const t = this.now();
    const done: IntentRecord[] = [];
    for (const r of this.byId.values()) {
      if (r.state !== 'reserved' && r.state !== 'sent') continue;
      const exp = r.reserve_expires_at_ms;
      if (exp === null) continue;
      if (t <= exp + this.graceMs) continue;
      const res = this.markExpired(r.quote_id);
      if (res.ok && res.outcome === 'applied') done.push(res.record);
    }
    return done;
  }

  size(): number {
    return this.byId.size;
  }

  pendingOutbox(): number {
    return this.outbox.pendingCount();
  }
}

function assertEdge(from: IntentState, to: IntentState): void {
  if (TERMINAL.has(from)) throw new Error(`terminal:${from}`);
  if (!ALLOWED[from].includes(to)) throw new Error(`illegal:${from}->${to}`);
}

function requestFingerprint(e: QuoteRequestEvent): string {
  return [
    e.assetIn,
    e.assetOut,
    e.exactAmountIn?.toString() ?? '',
    e.exactAmountOut?.toString() ?? '',
    String(e.minDeadlineMs),
  ].join('|');
}

function clone(r: IntentRecord): IntentRecord {
  return { ...r };
}

export type { OutboxRow };
