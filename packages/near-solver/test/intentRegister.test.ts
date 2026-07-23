import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { IntentRegister, OUTBOX_TOPIC_QUOTE_RESPONSE } from '../src/intentRegister.js';
import { Outbox } from '../src/outbox.js';
import { LedgerInventory, ReservingInventory } from '../src/solver.js';
import type { QuoteRequestEvent } from '../src/codec.js';
import type { QuoteDecision } from '../src/solver.js';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

function inv() {
  const base = new LedgerInventory(REGISTRY);
  base.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');
  base.deposit(USDC, 10_000_000000n, 'genesis');
  return new ReservingInventory(base, () => Date.parse('2026-07-20T12:00:00.000Z'));
}

function req(id: string, amountIn = 100_000000n): QuoteRequestEvent {
  return {
    quoteId: id,
    assetIn: USDC,
    assetOut: WNEAR,
    exactAmountIn: amountIn,
    minDeadlineMs: 60_000,
  };
}

function accept(id: string): QuoteDecision {
  return {
    shouldQuote: true,
    quoteId: id,
    assetIn: USDC,
    assetOut: WNEAR,
    amountInRaw: 100_000000n,
    amountOutRaw: 199n * 10n ** 24n,
    totalSpreadBps: 50,
    deadlineIso: '2026-07-20T12:01:00.000Z',
  };
}

function reject(id: string, reason: string): QuoteDecision {
  return { shouldQuote: false, quoteId: id, reason };
}

describe('Outbox', () => {
  it('enqueues and drains once', async () => {
    const box = new Outbox({ now: () => 1 });
    box.enqueue('t', 'k1', 'payload-a');
    box.enqueue('t', 'k1', 'payload-a'); // noop same
    expect(box.pendingCount()).toBe(1);
    expect(() => box.enqueue('t', 'k1', 'other')).toThrow(/outbox_conflict/);

    const published: string[] = [];
    const stats = await box.drain(async (row) => {
      published.push(row.payload);
      return { ok: true };
    });
    expect(stats.sent).toBe(1);
    expect(box.pendingCount()).toBe(0);
    expect(published).toEqual(['payload-a']);

    // second drain empty
    const stats2 = await box.drain(async () => ({ ok: true }));
    expect(stats2.sent).toBe(0);
  });

  it('retries then fails after maxAttempts', async () => {
    const box = new Outbox({ maxAttempts: 2, now: () => 1 });
    box.enqueue('t', 'k', 'p');
    await box.drain(async () => ({ ok: false, error: 'tmp' }));
    expect(box.pendingCount()).toBe(1);
    await box.drain(async () => ({ ok: false, error: 'tmp' }));
    expect(box.failedCount()).toBe(1);
  });
});

describe('IntentRegister state machine', () => {
  it('observe is idempotent on same fingerprint', () => {
    const reg = new IntentRegister({ inventory: inv(), mode: 'dry_run' });
    const a = reg.observe(req('q1'));
    const b = reg.observe(req('q1'));
    expect(a.ok && a.outcome).toBe('applied');
    expect(b.ok && b.outcome).toBe('noop');
  });

  it('observe conflicts on fingerprint mismatch', () => {
    const reg = new IntentRegister({ inventory: inv(), mode: 'dry_run' });
    reg.observe(req('q1', 100n));
    const bad = reg.observe(req('q1', 200n));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.err).toBe('conflict');
  });

  it('reject path: seen → decided_reject, no reserve', () => {
    const inventory = inv();
    const before = inventory.availableRaw(WNEAR);
    const reg = new IntentRegister({ inventory, mode: 'dry_run' });
    reg.observe(req('q1'));
    const res = reg.applyDecision('q1', reject('q1', 'no_price'));
    expect(res.ok && res.outcome).toBe('applied');
    expect(reg.get('q1')?.state).toBe('decided_reject');
    expect(inventory.availableRaw(WNEAR)).toBe(before);
  });

  it('accept path: seen → reserved holds inventory', () => {
    const inventory = inv();
    const before = inventory.availableRaw(WNEAR);
    const reg = new IntentRegister({ inventory, mode: 'dry_run' });
    reg.observe(req('q1'));
    const res = reg.applyDecision('q1', accept('q1'));
    expect(res.ok && res.outcome).toBe('applied');
    expect(reg.get('q1')?.state).toBe('reserved');
    expect(inventory.availableRaw(WNEAR)).toBeLessThan(before);
  });

  it('dry_run cannot markSent', () => {
    const reg = new IntentRegister({ inventory: inv(), mode: 'dry_run' });
    reg.observe(req('q1'));
    reg.applyDecision('q1', accept('q1'));
    const res = reg.markSent('q1', {
      quoteHash: 'hash1',
      framePayload: '{}',
      signerId: 's.near',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.detail).toMatch(/dry_run/);
  });

  it('live markSent enqueues outbox + indexes hash (one tx)', async () => {
    const outbox = new Outbox({ now: () => 42 });
    const reg = new IntentRegister({
      inventory: inv(),
      outbox,
      mode: 'live',
      now: () => 42,
    });
    reg.observe(req('q1'));
    reg.applyDecision('q1', accept('q1'));
    const frame = JSON.stringify({ method: 'quote_response', quote_id: 'q1' });
    const res = reg.markSent('q1', {
      quoteHash: 'qh_abc',
      framePayload: frame,
      signerId: 'solver.near',
    });
    expect(res.ok && res.outcome).toBe('applied');
    expect(reg.get('q1')?.state).toBe('sent');
    expect(reg.getByHash('qh_abc')?.quote_id).toBe('q1');
    expect(outbox.pendingCount()).toBe(1);

    const published: string[] = [];
    await outbox.drain(async (row) => {
      expect(row.topic).toBe(OUTBOX_TOPIC_QUOTE_RESPONSE);
      expect(row.idempotencyKey).toBe('q1');
      published.push(row.payload);
      return { ok: true };
    });
    expect(published).toEqual([frame]);
    expect(outbox.pendingCount()).toBe(0);

    // idempotent re-send mark
    const again = reg.markSent('q1', {
      quoteHash: 'qh_abc',
      framePayload: frame,
      signerId: 'solver.near',
    });
    expect(again.ok && again.outcome).toBe('noop');
  });

  it('settle is idempotent on same tx_hash; fill runs once', () => {
    const inventory = inv();
    const reg = new IntentRegister({
      inventory,
      mode: 'live',
      now: () => Date.parse('2026-07-20T12:00:00.000Z'),
    });
    reg.observe(req('q1'));
    reg.applyDecision('q1', accept('q1'));
    reg.markSent('q1', {
      quoteHash: 'qh',
      framePayload: '{}',
      signerId: 's.near',
    });

    let fills = 0;
    const apply = () => {
      fills += 1;
      inventory.commit('q1', {
        assetIn: USDC,
        amountInRaw: 100_000000n,
        assetOut: WNEAR,
        amountOutRaw: 199n * 10n ** 24n,
        txHash: 'tx1',
      });
    };

    const a = reg.markSettled({ quoteHash: 'qh' }, { intentHash: 'i1', txHash: 'tx1' }, apply);
    const b = reg.markSettled({ quoteHash: 'qh' }, { intentHash: 'i1', txHash: 'tx1' }, apply);
    expect(a.ok && a.outcome).toBe('applied');
    expect(b.ok && b.outcome).toBe('noop');
    expect(fills).toBe(1);
    expect(reg.get('q1')?.state).toBe('settled');
  });

  it('sweepExpired releases inventory', () => {
    let now = Date.parse('2026-07-20T12:00:00.000Z');
    const inventory = inv();
    const reg = new IntentRegister({
      inventory,
      mode: 'dry_run',
      now: () => now,
      graceMs: 0,
    });
    reg.observe(req('q1'));
    reg.applyDecision('q1', accept('q1'));
    const held = inventory.availableRaw(WNEAR);
    now = Date.parse('2026-07-20T12:01:01.000Z'); // past deadline
    const expired = reg.sweepExpired();
    expect(expired).toHaveLength(1);
    expect(reg.get('q1')?.state).toBe('expired');
    expect(inventory.availableRaw(WNEAR)).toBeGreaterThan(held);
  });

  it('kill switch blocks reserve', () => {
    const reg = new IntentRegister({
      inventory: inv(),
      mode: 'dry_run',
      killSwitchActive: () => true,
    });
    reg.observe(req('q1'));
    const res = reg.applyDecision('q1', accept('q1'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.detail).toBe('kill_switch');
  });
});
