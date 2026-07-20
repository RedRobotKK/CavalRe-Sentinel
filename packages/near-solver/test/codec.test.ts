import { describe, it, expect } from 'vitest';
import {
  parseRelayMessage,
  buildQuoteResponse,
  buildTokenDiffMessage,
} from '../src/codec';

const QUOTE_EVENT_RAW = JSON.stringify({
  jsonrpc: '2.0',
  method: 'subscribe',
  params: {
    subscription: 'sub-1',
    quote_id: 'q-123',
    defuse_asset_identifier_in: 'nep141:usdc.near',
    defuse_asset_identifier_out: 'nep141:wrap.near',
    exact_amount_in: '1000000000',
    min_deadline_ms: 60000,
  },
});

const SETTLEMENT_EVENT_RAW = JSON.stringify({
  jsonrpc: '2.0',
  method: 'subscribe',
  params: {
    quote_hash: 'qh-1',
    intent_hash: 'ih-1',
    tx_hash: '8yFNEk7GmRcM3NMJihwCKXt8ZANLpL2koVFWWH1MEEj',
  },
});

describe('parseRelayMessage', () => {
  it('parses a quote request event', () => {
    const msg = parseRelayMessage(QUOTE_EVENT_RAW);
    expect(msg.kind).toBe('quote_request');
    if (msg.kind !== 'quote_request') throw new Error('unreachable');
    expect(msg.event.quoteId).toBe('q-123');
    expect(msg.event.assetIn).toBe('nep141:usdc.near');
    expect(msg.event.assetOut).toBe('nep141:wrap.near');
    expect(msg.event.exactAmountIn).toBe(1000000000n);
    expect(msg.event.exactAmountOut).toBeUndefined();
    expect(msg.event.minDeadlineMs).toBe(60000);
  });

  it('parses a settlement event', () => {
    const msg = parseRelayMessage(SETTLEMENT_EVENT_RAW);
    expect(msg.kind).toBe('settlement');
    if (msg.kind !== 'settlement') throw new Error('unreachable');
    expect(msg.event.quoteHash).toBe('qh-1');
    expect(msg.event.txHash).toBe('8yFNEk7GmRcM3NMJihwCKXt8ZANLpL2koVFWWH1MEEj');
  });

  it('parses a subscription ack (rpc result)', () => {
    const msg = parseRelayMessage(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'sub-1' }));
    expect(msg.kind).toBe('rpc_result');
  });

  it('rejects malformed JSON without throwing', () => {
    const msg = parseRelayMessage('{not json');
    expect(msg.kind).toBe('malformed');
  });

  it('rejects a quote event with BOTH amounts (protocol violation)', () => {
    const raw = JSON.parse(QUOTE_EVENT_RAW);
    raw.params.exact_amount_out = '5';
    const msg = parseRelayMessage(JSON.stringify(raw));
    expect(msg.kind).toBe('malformed');
  });

  it('rejects a quote event with NEITHER amount', () => {
    const raw = JSON.parse(QUOTE_EVENT_RAW);
    delete raw.params.exact_amount_in;
    const msg = parseRelayMessage(JSON.stringify(raw));
    expect(msg.kind).toBe('malformed');
  });

  it('rejects non-integer amount strings (no float smuggling)', () => {
    const raw = JSON.parse(QUOTE_EVENT_RAW);
    raw.params.exact_amount_in = '1.5e9';
    const msg = parseRelayMessage(JSON.stringify(raw));
    expect(msg.kind).toBe('malformed');
  });

  it('rejects negative amounts', () => {
    const raw = JSON.parse(QUOTE_EVENT_RAW);
    raw.params.exact_amount_in = '-100';
    const msg = parseRelayMessage(JSON.stringify(raw));
    expect(msg.kind).toBe('malformed');
  });

  it('ignores unknown subscribe payload shapes as unknown, not crash', () => {
    const msg = parseRelayMessage(
      JSON.stringify({ jsonrpc: '2.0', method: 'subscribe', params: { something: 'else' } })
    );
    expect(msg.kind).toBe('unknown');
  });
});

describe('buildTokenDiffMessage', () => {
  it('builds solver-perspective diff: receives assetIn (+), gives assetOut (-)', () => {
    const message = buildTokenDiffMessage({
      signerId: 'solver.near',
      deadlineIso: '2026-07-20T12:00:00.000Z',
      assetIn: 'nep141:usdc.near',
      amountIn: 1000000000n,
      assetOut: 'nep141:wrap.near',
      amountOut: 250000000000000000000000n,
    });
    const parsed = JSON.parse(message);
    expect(parsed.signer_id).toBe('solver.near');
    expect(parsed.deadline).toBe('2026-07-20T12:00:00.000Z');
    expect(parsed.intents).toHaveLength(1);
    expect(parsed.intents[0].intent).toBe('token_diff');
    expect(parsed.intents[0].diff['nep141:usdc.near']).toBe('1000000000');
    expect(parsed.intents[0].diff['nep141:wrap.near']).toBe('-250000000000000000000000');
  });
});

describe('buildQuoteResponse', () => {
  it('wraps signed data into a quote_response JSON-RPC frame', () => {
    const frame = buildQuoteResponse({
      rpcId: 7,
      quoteId: 'q-123',
      quoteOutput: { amountOut: 42n },
      signedData: {
        standard: 'nep413',
        payload: { message: 'm', nonce: 'bm9uY2U=', recipient: 'intents.near' },
        publicKey: 'ed25519:abc',
        signature: 'ed25519:sig',
      },
    });
    const parsed = JSON.parse(frame);
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(7);
    expect(parsed.method).toBe('quote_response');
    expect(parsed.params[0].quote_id).toBe('q-123');
    expect(parsed.params[0].quote_output.amount_out).toBe('42');
    expect(parsed.params[0].signed_data.standard).toBe('nep413');
  });

  it('uses amount_in for exact-out quotes', () => {
    const frame = buildQuoteResponse({
      rpcId: 8,
      quoteId: 'q-124',
      quoteOutput: { amountIn: 99n },
      signedData: {
        standard: 'nep413',
        payload: { message: 'm', nonce: 'bm9uY2U=', recipient: 'intents.near' },
        publicKey: 'ed25519:abc',
        signature: 'ed25519:sig',
      },
    });
    const parsed = JSON.parse(frame);
    expect(parsed.params[0].quote_output.amount_in).toBe('99');
    expect(parsed.params[0].quote_output.amount_out).toBeUndefined();
  });
});
