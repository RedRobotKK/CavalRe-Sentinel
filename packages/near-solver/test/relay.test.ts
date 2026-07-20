import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RelayClient, type Transport, type TransportHandlers } from '../src/relay';
import type { QuoteRequestEvent, SettlementEvent } from '../src/codec';

class FakeTransport implements Transport {
  sent: string[] = [];
  closed = false;
  constructor(public handlers: TransportHandlers) {}
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
}

function makeClient() {
  const transports: FakeTransport[] = [];
  const quotes: QuoteRequestEvent[] = [];
  const settlements: SettlementEvent[] = [];
  const client = new RelayClient({
    url: 'wss://fake',
    transportFactory: (_url, handlers) => {
      const t = new FakeTransport(handlers);
      transports.push(t);
      return t;
    },
    onQuoteRequest: (e) => quotes.push(e),
    onSettlement: (e) => settlements.push(e),
    reconnectMinMs: 1000,
    reconnectMaxMs: 8000,
  });
  return { client, transports, quotes, settlements };
}

const QUOTE_FRAME = JSON.stringify({
  jsonrpc: '2.0',
  method: 'subscribe',
  params: {
    subscription: 's',
    quote_id: 'q-9',
    defuse_asset_identifier_in: 'nep141:a.near',
    defuse_asset_identifier_out: 'nep141:b.near',
    exact_amount_in: '5',
    min_deadline_ms: 60000,
  },
});

describe('RelayClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('subscribes to quote and quote_status on open', () => {
    const { client, transports } = makeClient();
    client.start();
    transports[0]!.handlers.onOpen();
    const methods = transports[0]!.sent.map((s) => JSON.parse(s));
    expect(methods).toHaveLength(2);
    expect(methods[0].method).toBe('subscribe');
    expect(methods[0].params).toEqual(['quote']);
    expect(methods[1].params).toEqual(['quote_status']);
  });

  it('dispatches quote events to the handler', () => {
    const { client, transports, quotes } = makeClient();
    client.start();
    transports[0]!.handlers.onOpen();
    transports[0]!.handlers.onMessage(QUOTE_FRAME);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]!.quoteId).toBe('q-9');
    expect(quotes[0]!.exactAmountIn).toBe(5n);
  });

  it('counts malformed frames without crashing', () => {
    const { client, transports } = makeClient();
    client.start();
    transports[0]!.handlers.onOpen();
    transports[0]!.handlers.onMessage('garbage{{{');
    expect(client.stats.malformedFrames).toBe(1);
  });

  it('reconnects with exponential backoff after close', () => {
    const { client, transports } = makeClient();
    client.start();
    expect(transports).toHaveLength(1);

    transports[0]!.handlers.onClose();
    vi.advanceTimersByTime(999);
    expect(transports).toHaveLength(1); // not yet
    vi.advanceTimersByTime(1);
    expect(transports).toHaveLength(2); // reconnected at 1000ms

    transports[1]!.handlers.onClose();
    vi.advanceTimersByTime(2000);
    expect(transports).toHaveLength(3); // second retry doubles to 2000ms
  });

  it('backoff resets after a successful open', () => {
    const { client, transports } = makeClient();
    client.start();
    transports[0]!.handlers.onClose();
    vi.advanceTimersByTime(1000); // retry 1 -> transport 2
    transports[1]!.handlers.onOpen(); // success resets backoff
    transports[1]!.handlers.onClose();
    vi.advanceTimersByTime(1000);
    expect(transports).toHaveLength(3); // back to min delay
  });

  it('stop() closes and suppresses reconnection', () => {
    const { client, transports } = makeClient();
    client.start();
    client.stop();
    expect(transports[0]!.closed).toBe(true);
    transports[0]!.handlers.onClose();
    vi.advanceTimersByTime(60_000);
    expect(transports).toHaveLength(1); // no zombie reconnects
  });

  it('sendFrame delivers raw frames over the active transport', () => {
    const { client, transports } = makeClient();
    client.start();
    transports[0]!.handlers.onOpen();
    client.sendFrame('{"x":1}');
    expect(transports[0]!.sent).toContain('{"x":1}');
  });
});
