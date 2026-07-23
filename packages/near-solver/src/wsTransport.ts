/**
 * LIVE WEBSOCKET TRANSPORT
 *
 * Adapts WebSocket to the Transport interface. When PARTNER_JWT is set,
 * Authorization: Bearer is sent on the handshake (required by
 * solver-relay-v2 — docs.near-intents.org message-bus/websocket).
 *
 * Without JWT the socket may still open TCP; quote frames will not arrive.
 * That is an external gate, not a code bug.
 */

import type { Transport, TransportFactory, TransportHandlers } from './relay.js';

interface MinimalWebSocket {
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

type WebSocketCtor = new (
  url: string,
  protocolsOrOptions?: string | string[] | { headers?: Record<string, string> }
) => MinimalWebSocket;

export interface WebSocketTransportOptions {
  /** Full Authorization header value, e.g. "Bearer eyJ…". */
  authorization?: string;
  ctor?: WebSocketCtor;
}

export function makeWebSocketTransportFactory(
  options: WebSocketTransportOptions = {}
): TransportFactory {
  const WsCtor =
    options.ctor ??
    ((globalThis as { WebSocket?: WebSocketCtor }).WebSocket ?? null);
  if (WsCtor === null) {
    throw new Error('No WebSocket available: need Node >= 21 or an injected constructor');
  }

  return (url: string, handlers: TransportHandlers): Transport => {
    let ws: MinimalWebSocket;
    if (options.authorization) {
      // Node undici WebSocket accepts headers as second-arg options.
      // If a runtime ignores headers, frames stay 0 — status reports auth_present.
      try {
        ws = new WsCtor(url, { headers: { Authorization: options.authorization } });
      } catch {
        ws = new WsCtor(url);
      }
    } else {
      ws = new WsCtor(url);
    }
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

/** Build Authorization value from env PARTNER_JWT (or empty). */
export function authorizationFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const jwt = env['PARTNER_JWT']?.trim();
  if (!jwt) return undefined;
  if (jwt.toLowerCase().startsWith('bearer ')) return jwt;
  return `Bearer ${jwt}`;
}
