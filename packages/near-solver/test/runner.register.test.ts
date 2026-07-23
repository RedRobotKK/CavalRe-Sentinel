/**
 * Runner ↔ IntentRegister wiring: dry-run accept lands in reserved.
 */
import { describe, it, expect } from 'vitest';
import * as FloatLib from '@cavalre/floatlib-ts';
import { SolverRunner } from '../src/runner.js';
import { LedgerInventory } from '../src/solver.js';
import { SolverRiskGuard } from '../src/risk.js';
import type { Transport, TransportHandlers } from '../src/relay.js';

const USDC = 'nep141:usdc.near';
const WNEAR = 'nep141:wrap.near';
const REGISTRY = new Map([
  [USDC, { symbol: 'USDC', decimals: 6n }],
  [WNEAR, { symbol: 'wNEAR', decimals: 24n }],
]);

const priceSource = {
  mid: (a: string, b: string) =>
    a === USDC && b === WNEAR ? FloatLib.toFloat(2n, 0n) : null,
  usdPrice: (a: string) =>
    a === USDC ? FloatLib.ONE : a === WNEAR ? FloatLib.toFloat(5n, 1n) : null,
};

function quoteFrame(id: string): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'subscribe',
    params: {
      subscription: 's',
      quote_id: id,
      defuse_asset_identifier_in: USDC,
      defuse_asset_identifier_out: WNEAR,
      exact_amount_in: '100000000',
      min_deadline_ms: 60000,
    },
  });
}

describe('SolverRunner IntentRegister wiring', () => {
  it('dry-run accept → register state reserved + counts', () => {
    let handlers!: TransportHandlers;
    const inventory = new LedgerInventory(REGISTRY);
    inventory.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');
    inventory.deposit(USDC, 10_000_000000n, 'genesis');

    const runner = new SolverRunner({
      registry: REGISTRY,
      priceSource,
      baseInventory: inventory,
      riskGuard: new SolverRiskGuard({
        maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
        maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
      }),
      solverConfig: {
        signerId: 'sentinel-solver.near',
        halfSpreadBps: 50,
        maxInventorySkewBps: 100,
        quoteValidityMs: 60_000,
        maxDeadlineMs: 120_000,
        minNotionalUsd: FloatLib.toFloat(10n, 0n),
      },
      relay: {
        url: 'wss://fake',
        transportFactory: (_u: string, h: TransportHandlers): Transport => {
          handlers = h;
          return { send: () => {}, close: () => {} };
        },
        reconnectMinMs: 1000,
        reconnectMaxMs: 8000,
      },
      dryRun: true,
      now: () => Date.parse('2026-07-20T12:00:00.000Z'),
    });

    runner.start();
    handlers.onOpen();
    handlers.onMessage(quoteFrame('q-reg-1'));

    expect(runner.register.get('q-reg-1')?.state).toBe('reserved');
    expect(runner.register.countsByState().reserved).toBe(1);
    expect(runner.metrics.counters['quote_decision:would_quote_dry_run']).toBe(1);
  });

  it('reject → decided_reject, no reserve', () => {
    let handlers!: TransportHandlers;
    const inventory = new LedgerInventory(REGISTRY);
    inventory.deposit(WNEAR, 1_000n * 10n ** 24n, 'genesis');

    const runner = new SolverRunner({
      registry: REGISTRY,
      priceSource,
      baseInventory: inventory,
      riskGuard: new SolverRiskGuard({
        maxQuoteNotionalUsd: FloatLib.toFloat(10_000n, 0n),
        maxDailyLossUsd: FloatLib.toFloat(500n, 0n),
      }),
      solverConfig: {
        signerId: 'sentinel-solver.near',
        halfSpreadBps: 50,
        maxInventorySkewBps: 100,
        quoteValidityMs: 60_000,
        maxDeadlineMs: 120_000,
        minNotionalUsd: FloatLib.toFloat(10n, 0n),
      },
      relay: {
        url: 'wss://fake',
        transportFactory: (_u: string, h: TransportHandlers): Transport => {
          handlers = h;
          return { send: () => {}, close: () => {} };
        },
        reconnectMinMs: 1000,
        reconnectMaxMs: 8000,
      },
      dryRun: true,
      now: () => Date.parse('2026-07-20T12:00:00.000Z'),
    });

    runner.start();
    handlers.onOpen();
    handlers.onMessage(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'subscribe',
        params: {
          subscription: 's',
          quote_id: 'q-bad',
          defuse_asset_identifier_in: 'nep141:unknown.near',
          defuse_asset_identifier_out: WNEAR,
          exact_amount_in: '100000000',
          min_deadline_ms: 60000,
        },
      })
    );

    expect(runner.register.get('q-bad')?.state).toBe('decided_reject');
    expect(runner.register.countsByState().decided_reject).toBe(1);
    expect(runner.metrics.counters['quote_decision:asset_not_listed']).toBe(1);
  });
});
