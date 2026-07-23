/**
 * Atomic multi-asset fill (intent "swap") on the off-chain ledger replica.
 *
 * CavalRe contracts are accounting-first — there is no AMM pool module.
 * A NEAR Intents fill is: receive tokenIn, pay tokenOut, one version bump.
 * All amounts are FloatLib.FloatFixed (NEVER TRUST JS Number on money).
 *
 * Reference model: cavalre-contracts modules/ledger (double-entry posture).
 */

import * as FloatLib from '@cavalre/floatlib-ts';
import type { Ledger } from './ledger.js';

export interface SwapFill {
  account: string;
  tokenIn: string;
  amountIn: FloatLib.FloatFixed;
  tokenOut: string;
  amountOut: FloatLib.FloatFixed;
  txHash: string;
  blockNumber: bigint;
}

/**
 * Apply an intent fill atomically on `ledger`.
 * - Credits tokenIn (deposit)
 * - Debits tokenOut (withdrawal) with overdraw check
 * - Two balance events, then relies on ledger versioning per change
 *
 * Prefer this over ad-hoc pairs of applyBalanceChange for fills so
 * overdraw is checked before either leg mutates when possible.
 */
export function applySwapFill(ledger: Ledger, fill: SwapFill): void {
  if (ledger.isDiverged()) {
    throw new Error('State diverged - cannot apply swap fill');
  }
  if (FloatLib.isLT(fill.amountIn, FloatLib.ZERO) || FloatLib.isLT(fill.amountOut, FloatLib.ZERO)) {
    throw new Error('swap fill amounts must be non-negative');
  }

  const availableOut = ledger.getBalance(fill.account, fill.tokenOut);
  if (FloatLib.isLT(availableOut, fill.amountOut)) {
    throw new Error(
      `inventory overdraw on swap fill ${fill.txHash}: need out leg, insufficient ${fill.tokenOut}`
    );
  }

  // Receive assetIn first, then pay assetOut (solver inventory).
  ledger.applyBalanceChange({
    account: fill.account,
    token: fill.tokenIn,
    amount: fill.amountIn,
    type: 'deposit',
    txHash: fill.txHash,
    blockNumber: fill.blockNumber,
  });
  ledger.applyBalanceChange({
    account: fill.account,
    token: fill.tokenOut,
    amount: fill.amountOut,
    type: 'withdrawal',
    txHash: fill.txHash,
    blockNumber: fill.blockNumber,
  });
}
