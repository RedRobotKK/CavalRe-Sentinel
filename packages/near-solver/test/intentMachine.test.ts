/**
 * XState intent machine — transition graph locked via createActor.
 * Mirrors IntentRegister edges; does not touch real inventory.
 */
import { describe, it, expect } from 'vitest';
import {
  createIntentActor,
  intentState,
  intentContext,
} from '../src/intentMachine.js';

describe('intentMachine (XState)', () => {
  it('starts in seen', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'dry_run',
    });
    expect(intentState(a)).toBe('seen');
  });

  it('seen → decided_reject', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'dry_run',
    });
    a.send({ type: 'DECIDE_REJECT', reason: 'no_price' });
    expect(intentState(a)).toBe('decided_reject');
    expect(intentContext(a).reason).toBe('no_price');
    expect(intentContext(a).effects).toEqual([]);
  });

  it('seen → reserved logs reserve effect', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'dry_run',
    });
    a.send({
      type: 'DECIDE_ACCEPT',
      assetOut: 'nep141:wrap.near',
      amountOutRaw: '199',
      expiresAtMs: 1_000,
    });
    expect(intentState(a)).toBe('reserved');
    expect(intentContext(a).effects).toEqual(['reserve']);
  });

  it('dry_run: MARK_SENT from reserved is ignored (guard isLive)', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'dry_run',
    });
    a.send({
      type: 'DECIDE_ACCEPT',
      assetOut: 'out',
      amountOutRaw: '1',
      expiresAtMs: 1,
    });
    a.send({ type: 'MARK_SENT', quoteHash: 'h', framePayload: '{}' });
    expect(intentState(a)).toBe('reserved');
    expect(intentContext(a).effects).toEqual(['reserve']);
  });

  it('live: reserved → sent → settled', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'live',
    });
    a.send({
      type: 'DECIDE_ACCEPT',
      assetOut: 'out',
      amountOutRaw: '1',
      expiresAtMs: 1,
    });
    a.send({ type: 'MARK_SENT', quoteHash: 'qh', framePayload: '{"ok":1}' });
    expect(intentState(a)).toBe('sent');
    expect(intentContext(a).quoteHash).toBe('qh');
    expect(intentContext(a).effects).toEqual(['reserve', 'outbox_enqueue']);

    a.send({ type: 'MARK_SETTLED', txHash: 'tx1', intentHash: 'i1' });
    expect(intentState(a)).toBe('settled');
    expect(intentContext(a).txHash).toBe('tx1');
    expect(intentContext(a).effects).toEqual([
      'reserve',
      'outbox_enqueue',
      'apply_fill',
      'release',
    ]);
  });

  it('reserved → expired is idempotent on second EXPIRE', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'dry_run',
    });
    a.send({
      type: 'DECIDE_ACCEPT',
      assetOut: 'out',
      amountOutRaw: '1',
      expiresAtMs: 1,
    });
    a.send({ type: 'EXPIRE' });
    expect(intentState(a)).toBe('expired');
    a.send({ type: 'EXPIRE' });
    expect(intentState(a)).toBe('expired');
    expect(intentContext(a).effects).toEqual(['reserve', 'release']);
  });

  it('illegal: seen cannot MARK_SETTLED', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'live',
    });
    a.send({ type: 'MARK_SETTLED', txHash: 'tx', intentHash: 'i' });
    expect(intentState(a)).toBe('seen');
    expect(intentContext(a).effects).toEqual([]);
  });

  it('snapshot status matches final for settled', () => {
    const a = createIntentActor({
      quoteId: 'q1',
      fingerprint: 'fp',
      mode: 'live',
    });
    a.send({
      type: 'DECIDE_ACCEPT',
      assetOut: 'out',
      amountOutRaw: '1',
      expiresAtMs: 1,
    });
    a.send({ type: 'MARK_SENT', quoteHash: 'h', framePayload: '{}' });
    a.send({ type: 'MARK_SETTLED', txHash: 't', intentHash: 'i' });
    expect(a.getSnapshot().status).toBe('done');
  });
});
