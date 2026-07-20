/**
 * intents.near balance fetcher (Multi-Token standard mt_batch_balance_of).
 * Security: response length and digit-string format are validated strictly —
 * a wrong-length or non-numeric response throws (the Reconciler already
 * treats a throwing fetcher as a safe no-op, proven by its tests).
 */
import { describe, it, expect } from 'vitest';
import { IntentsBalanceFetcher } from '../src/balanceFetcher';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';

function viewStub(result: unknown, capture?: { args?: unknown }) {
  return {
    async callView(_contract: string, _method: string, args: unknown): Promise<unknown> {
      if (capture) capture.args = args;
      return result;
    },
  };
}

describe('IntentsBalanceFetcher', () => {
  it('maps token ids to bigint balances', async () => {
    const capture: { args?: any } = {};
    const fetcher = new IntentsBalanceFetcher({
      rpc: viewStub(['1000000000', '250000000000000000000000000'], capture),
      accountId: 'sentinel-solver.near',
    });
    const balances = await fetcher.fetchBalances([USDC, WNEAR]);
    expect(balances.get(USDC)).toBe(1_000000000n);
    expect(balances.get(WNEAR)).toBe(250_000000000000000000000000n);
    expect(capture.args).toEqual({
      account_id: 'sentinel-solver.near',
      token_ids: [USDC, WNEAR],
    });
  });

  it('throws when the response length does not match the request', async () => {
    const fetcher = new IntentsBalanceFetcher({
      rpc: viewStub(['1']),
      accountId: 's.near',
    });
    await expect(fetcher.fetchBalances([USDC, WNEAR])).rejects.toThrow(/length/i);
  });

  it('throws on non-digit balance strings (no NaN smuggling into the ledger)', async () => {
    const fetcher = new IntentsBalanceFetcher({
      rpc: viewStub(['100', '0x1f']),
      accountId: 's.near',
    });
    await expect(fetcher.fetchBalances([USDC, WNEAR])).rejects.toThrow(/invalid balance/i);
  });

  it('throws when the response is not an array at all', async () => {
    const fetcher = new IntentsBalanceFetcher({
      rpc: viewStub({ weird: true }),
      accountId: 's.near',
    });
    await expect(fetcher.fetchBalances([USDC])).rejects.toThrow(/invalid response/i);
  });
});
