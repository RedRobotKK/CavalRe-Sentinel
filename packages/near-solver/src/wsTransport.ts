/**
 * LIVE WEBSOCKET TRANSPORT
 *
 * Adapts the global WebSocket (Node >= 21) to the Transport interface the
 * relay client expects. This is the ONLY module that touches real I/O for
 * the bus; everything else is tested against fakes.
 */

import type { Transport, TransportFactory, TransportHandlers } from './relay';

interface MinimalWebSocket {
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

type WebSocketCtor = new (url: string) => MinimalWebSocket;

export function makeWebSocketTransportFactory(
  ctor?: WebSocketCtor
): TransportFactory {
  const WsCtor =
    ctor ?? ((globalThis as { WebSocket?: WebSocketCtor }).WebSocket ?? null);
  if (WsCtor === null) {
    throw new Error('No WebSocket available: need Node >= 21 or an injected constructor');
  }

  return (url: string, handlers: TransportHandlers): Transport => {
    const ws = new WsCtor(url);
    ws.onopen = () => handlers.onOpen();
    ws.onmessage = (ev) => handlers.onMessage(String(ev.data));
    ws.onclose = () => handlers.onClose();
    ws.onerror = () => handlers.onError();
    return {
      send: (data: string) => ws.send(data),
      close: () => ws.close(),
    };
  };
}
