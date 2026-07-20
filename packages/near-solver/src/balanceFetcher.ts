/**
 * INTENTS.NEAR BALANCE FETCHER
 *
 * OnChainBalanceFetcher backed by the verifier contract's Multi-Token
 * `mt_batch_balance_of`. Token ids on intents.near ARE the defuse asset ids
 * this package uses everywhere, so no mapping layer is needed.
 *
 * Security: strict validation — array shape, per-request length match, and
 * digit-string balances with the same length cap the codec uses. A throwing
 * fetcher is safe: the Reconciler propagates and changes no state (tested).
 */

import type { OnChainBalanceFetcher } from './reconciler';
import type { ViewCaller } from './nearRpc';

const DEFAULT_CONTRACT_ID = 'intents.near';
/** Same rationale as codec S1: u128 max is 39 digits. */
const MAX_BALANCE_DIGITS = 40;

export interface IntentsBalanceFetcherOptions {
  rpc: ViewCaller;
  /** The solver's account on the verifier contract. */
  accountId: string;
  contractId?: string;
}

export class IntentsBalanceFetcher implements OnChainBalanceFetcher {
  private readonly contractId: string;

  constructor(private readonly opts: IntentsBalanceFetcherOptions) {
    this.contractId = opts.contractId ?? DEFAULT_CONTRACT_ID;
  }

  async fetchBalances(assets: string[]): Promise<Map<string, bigint>> {
    const raw = await this.opts.rpc.callView(this.contractId, 'mt_batch_balance_of', {
      account_id: this.opts.accountId,
      token_ids: assets,
    });

    if (!Array.isArray(raw)) {
      throw new Error(`invalid response from mt_batch_balance_of: expected array`);
    }
    if (raw.length !== assets.length) {
      throw new Error(
        `mt_batch_balance_of length mismatch: asked ${assets.length}, got ${raw.length}`
      );
    }

    const balances = new Map<string, bigint>();
    for (let i = 0; i < assets.length; i++) {
      const value = raw[i];
      if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > MAX_BALANCE_DIGITS ||
        !/^[0-9]+$/.test(value)
      ) {
        throw new Error(`invalid balance for ${assets[i]}: ${String(value)}`);
      }
      balances.set(assets[i]!, BigInt(value));
    }
    return balances;
  }
}
