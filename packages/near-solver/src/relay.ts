/**
 * RELAY CLIENT
 *
 * Thin, fully-testable connection manager for the solver bus WebSocket.
 * The transport is injected (production: a WebSocket wrapper; tests: a fake),
 * so this module owns exactly three concerns:
 *   - subscribe to "quote" and "quote_status" on open
 *   - parse frames via the codec and dispatch typed events
 *   - reconnect with capped exponential backoff; stop() means stop
 */

import { parseRelayMessage, type QuoteRequestEvent, type SettlementEvent } from './codec';

/** Security (S2): frames above this size are dropped unparsed. */
const MAX_FRAME_BYTES = 262_144; // 256 KiB — real bus frames are < 2 KiB

export interface TransportHandlers {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: () => void;
  onError: () => void;
}

export interface Transport {
  send(data: string): void;
  close(): void;
}

export type TransportFactory = (url: string, handlers: TransportHandlers) => Transport;

export interface RelayClientOptions {
  url: string;
  transportFactory: TransportFactory;
  onQuoteRequest: (event: QuoteRequestEvent) => void;
  onSettlement: (event: SettlementEvent) => void;
  reconnectMinMs: number;
  reconnectMaxMs: number;
}

export interface RelayStats {
  framesReceived: number;
  malformedFrames: number;
  reconnects: number;
}

export class RelayClient {
  private transport: Transport | null = null;
  private running = false;
  private reconnectDelayMs: number;
  private rpcId = 0;

  readonly stats: RelayStats = { framesReceived: 0, malformedFrames: 0, reconnects: 0 };

  constructor(private readonly opts: RelayClientOptions) {
    this.reconnectDelayMs = opts.reconnectMinMs;
  }

  start(): void {
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.transport?.close();
    this.transport = null;
  }

  /** Send a raw JSON-RPC frame (e.g. a quote_response built by the codec). */
  sendFrame(frame: string): void {
    if (!this.transport) throw new Error('relay not connected');
    this.transport.send(frame);
  }

  nextRpcId(): number {
    return ++this.rpcId;
  }

  private connect(): void {
    if (!this.running) return;
    this.transport = this.opts.transportFactory(this.opts.url, {
      onOpen: () => {
        this.reconnectDelayMs = this.opts.reconnectMinMs; // success resets backoff
        this.sendFrame(
          JSON.stringify({ jsonrpc: '2.0', id: this.nextRpcId(), method: 'subscribe', params: ['quote'] })
        );
        this.sendFrame(
          JSON.stringify({ jsonrpc: '2.0', id: this.nextRpcId(), method: 'subscribe', params: ['quote_status'] })
        );
      },
      onMessage: (data) => this.handleFrame(data),
      onClose: () => this.scheduleReconnect(),
      onError: () => {
        // errors surface as closes; nothing to do here beyond accounting
      },
    });
  }

  private scheduleReconnect(): void {
    if (!this.running) return;
    this.transport = null;
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.opts.reconnectMaxMs);
    setTimeout(() => {
      if (!this.running) return;
      this.stats.reconnects += 1;
      this.connect();
    }, delay);
  }

  private handleFrame(data: string): void {
    this.stats.framesReceived += 1;
    // Security (S2): drop oversized frames before JSON.parse touches them.
    if (data.length > MAX_FRAME_BYTES) {
      this.stats.malformedFrames += 1;
      return;
    }
    const msg = parseRelayMessage(data);
    switch (msg.kind) {
      case 'quote_request':
        this.opts.onQuoteRequest(msg.event);
        break;
      case 'settlement':
        this.opts.onSettlement(msg.event);
        break;
      case 'malformed':
        this.stats.malformedFrames += 1;
        break;
      case 'rpc_result':
      case 'unknown':
        break; // acks and unrecognized-but-valid frames are fine
    }
  }
}
