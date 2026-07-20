/**
 * NEAR RPC VIEW CLIENT
 *
 * Minimal JSON-RPC `query`/`call_function` client for contract view calls.
 * X7 (SRE): every call carries an AbortController timeout so a hung RPC can
 * never hang the reconcile loop or a price refresh.
 */

const DEFAULT_TIMEOUT_MS = 5_000;

interface FetchResponseLike {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<FetchResponseLike>;

export interface NearRpcOptions {
  url: string; // e.g. https://rpc.mainnet.near.org
  timeoutMs?: number;
  fetchFn?: FetchLike; // injected in tests; defaults to global fetch
}

/** The narrow surface adapters depend on — lets tests stub one method. */
export interface ViewCaller {
  callView(contractId: string, methodName: string, args: unknown): Promise<unknown>;
}

export class NearRpcClient implements ViewCaller {
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;
  private rpcId = 0;

  constructor(private readonly opts: NearRpcOptions) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = opts.fetchFn ?? (fetch as unknown as FetchLike);
  }

  async callView(contractId: string, methodName: string, args: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(this.opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++this.rpcId,
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: contractId,
            method_name: methodName,
            args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RPC HTTP ${response.status ?? 'error'} from ${this.opts.url}`);
      }
      const body = (await response.json()) as {
        error?: { message?: string };
        result?: { result?: unknown };
      };
      if (body.error) {
        throw new Error(`RPC error: ${body.error.message ?? JSON.stringify(body.error)}`);
      }
      const bytes = body.result?.result;
      if (!Array.isArray(bytes) || !bytes.every((b) => typeof b === 'number')) {
        throw new Error('malformed RPC response: missing result byte array');
      }
      return JSON.parse(Buffer.from(Uint8Array.from(bytes as number[])).toString('utf8'));
    } finally {
      clearTimeout(timer);
    }
  }
}
