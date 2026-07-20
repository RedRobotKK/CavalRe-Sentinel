/**
 * NEAR RPC view client. Findings encoded:
 *  X7 (SRE): every call carries an abort timeout — a hung RPC must never
 *     hang the reconcile loop.
 *  Security: responses are validated structurally; RPC errors throw; result
 *  bytes are decoded and parsed, never eval'd or trusted beyond JSON.
 */
import { describe, it, expect } from 'vitest';
import { NearRpcClient } from '../src/nearRpc';

function rpcResultBytes(payload: unknown): number[] {
  return [...Buffer.from(JSON.stringify(payload))];
}

function fetchStub(response: unknown, capture?: { body?: unknown; signal?: AbortSignal }) {
  return async (_url: string, init: { body: string; signal: AbortSignal }) => {
    if (capture) {
      capture.body = JSON.parse(init.body);
      capture.signal = init.signal;
    }
    return {
      ok: true,
      json: async () => response,
    };
  };
}

describe('NearRpcClient.callView', () => {
  it('encodes args as base64 and decodes byte-array results into JSON', async () => {
    const capture: { body?: any; signal?: AbortSignal } = {};
    const client = new NearRpcClient({
      url: 'https://rpc.fake',
      timeoutMs: 1000,
      fetchFn: fetchStub(
        { jsonrpc: '2.0', id: 1, result: { result: rpcResultBytes(['123', '456']) } },
        capture
      ) as never,
    });
    const out = await client.callView('intents.near', 'mt_batch_balance_of', {
      account_id: 'solver.near',
      token_ids: ['a', 'b'],
    });
    expect(out).toEqual(['123', '456']);
    expect(capture.body.params.request_type).toBe('call_function');
    expect(capture.body.params.account_id).toBe('intents.near');
    expect(capture.body.params.method_name).toBe('mt_batch_balance_of');
    const decodedArgs = JSON.parse(
      Buffer.from(capture.body.params.args_base64, 'base64').toString()
    );
    expect(decodedArgs.account_id).toBe('solver.near');
  });

  it('X7: passes an abort signal and rejects when the RPC hangs past timeoutMs', async () => {
    const client = new NearRpcClient({
      url: 'https://rpc.fake',
      timeoutMs: 20,
      fetchFn: ((_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        })) as never,
    });
    await expect(client.callView('c.near', 'm', {})).rejects.toThrow(/aborted|timeout/i);
  });

  it('throws on an RPC-level error instead of returning garbage', async () => {
    const client = new NearRpcClient({
      url: 'https://rpc.fake',
      timeoutMs: 1000,
      fetchFn: fetchStub({
        jsonrpc: '2.0',
        id: 1,
        error: { cause: { name: 'UNKNOWN_ACCOUNT' }, message: 'account missing' },
      }) as never,
    });
    await expect(client.callView('c.near', 'm', {})).rejects.toThrow(/account missing/);
  });

  it('throws on structurally invalid responses (no result bytes)', async () => {
    const client = new NearRpcClient({
      url: 'https://rpc.fake',
      timeoutMs: 1000,
      fetchFn: fetchStub({ jsonrpc: '2.0', id: 1, result: { nope: true } }) as never,
    });
    await expect(client.callView('c.near', 'm', {})).rejects.toThrow(/malformed/i);
  });

  it('throws on HTTP-level failure', async () => {
    const client = new NearRpcClient({
      url: 'https://rpc.fake',
      timeoutMs: 1000,
      fetchFn: (async () => ({ ok: false, status: 503, json: async () => ({}) })) as never,
    });
    await expect(client.callView('c.near', 'm', {})).rejects.toThrow(/503/);
  });
});
