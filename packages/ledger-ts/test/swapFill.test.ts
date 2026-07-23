import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { Ledger } from '../src/ledger';
import { applySwapFill } from '../src/swapFill';

describe('applySwapFill (intent accounting)', () => {
  it('credits tokenIn and debits tokenOut on one account', () => {
    const ledger = new Ledger();
    ledger.applyBalanceChange({
      account: 'solver',
      token: 'wNEAR',
      amount: FloatLib.toFloat(10n, 0n),
      type: 'deposit',
      txHash: 'gen',
      blockNumber: 1n,
    });

    applySwapFill(ledger, {
      account: 'solver',
      tokenIn: 'USDC',
      amountIn: FloatLib.toFloat(5n, 0n),
      tokenOut: 'wNEAR',
      amountOut: FloatLib.toFloat(2n, 0n),
      txHash: 'fill1',
      blockNumber: 2n,
    });

    expect(FloatLib.toNumber(ledger.getBalance('solver', 'USDC'))).toBeCloseTo(5, 6);
    expect(FloatLib.toNumber(ledger.getBalance('solver', 'wNEAR'))).toBeCloseTo(8, 6);
  });

  it('throws on insufficient tokenOut before accepting the fill', () => {
    const ledger = new Ledger();
    expect(() =>
      applySwapFill(ledger, {
        account: 'solver',
        tokenIn: 'USDC',
        amountIn: FloatLib.toFloat(1n, 0n),
        tokenOut: 'wNEAR',
        amountOut: FloatLib.toFloat(1n, 0n),
        txHash: 'x',
        blockNumber: 1n,
      })
    ).toThrow(/overdraw/);
  });
});
