import { describe, it, expect } from 'vitest';
import { makeWebSocketTransportFactory } from '../src/wsTransport';
import type { TransportHandlers } from '../src/relay';

class StubWebSocket {
  static instances: StubWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;
  constructor(
    public url: string,
    _opts?: unknown
  ) {
    StubWebSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
}

function handlers(): TransportHandlers & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    onOpen: () => events.push('open'),
    onMessage: (d) => events.push(`msg:${d}`),
    onClose: () => events.push('close'),
    onError: () => events.push('error'),
  };
}

describe('makeWebSocketTransportFactory', () => {
  it('wires WebSocket events to transport handlers', () => {
    StubWebSocket.instances = [];
    const factory = makeWebSocketTransportFactory({ ctor: StubWebSocket as never });
    const h = handlers();
    const transport = factory('wss://example', h);
    const ws = StubWebSocket.instances.at(-1)!;

    ws.onopen!();
    ws.onmessage!({ data: 'hello' });
    ws.onclose!();
    expect(h.events).toEqual(['open', 'msg:hello', 'close']);

    transport.send('frame');
    expect(ws.sent).toEqual(['frame']);
    transport.close();
    expect(ws.closed).toBe(true);
  });

  it('coerces non-string message data to string (Buffer frames)', () => {
    StubWebSocket.instances = [];
    const factory = makeWebSocketTransportFactory({ ctor: StubWebSocket as never });
    const h = handlers();
    factory('wss://example', h);
    const ws = StubWebSocket.instances.at(-1)!;
    ws.onmessage!({ data: Buffer.from('{"a":1}') });
    expect(h.events[0]).toBe('msg:{"a":1}');
  });
});
